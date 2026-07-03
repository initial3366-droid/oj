import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ── Verdict Colors ──
const VERDICT_COLORS: Record<string, string> = {
  AC: '#10b981', WA: '#ef4444', TLE: '#f59e0b', CE: '#8b5cf6',
  RE: '#ec4899', MLE: '#06b6d4', NOO: '#94a3b8', SE: '#94a3b8',
  FAILED: '#94a3b8',
};

const DIFFICULTY_NAMES: Record<number, string> = { 1: '入门', 2: '简单', 3: '中等', 4: '困难', 5: '地狱' };
const DIFFICULTY_COLORS: Record<number, string> = { 1: '#10b981', 2: '#3b82f6', 3: '#f59e0b', 4: '#ef4444', 5: '#7c3aed' };

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.96)', border: '1px solid #e5e7eb',
      borderRadius: 10, padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          {p.name}: <b>{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</b>
        </div>
      ))}
    </div>
  );
}

// ── Submission Trend (Area Chart) ──
export function SubmissionTrendChart({ data }: { data?: Array<{ date: string; total: number; accepted: number }> }) {
  if (!data?.length) return <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gAccepted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="total" name="总提交" stroke="#2563eb" strokeWidth={2.5} fill="url(#gTotal)" />
        <Area type="monotone" dataKey="accepted" name="通过" stroke="#10b981" strokeWidth={2.5} fill="url(#gAccepted)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Verdict Distribution (Donut Chart) ──
export function VerdictDonutChart({ data }: { data?: Array<{ verdict: string; count: number }> }) {
  if (!data?.length) return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map(d => ({ name: d.verdict, value: d.count, color: VERDICT_COLORS[d.verdict] || '#94a3b8' }));
  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {chartData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
          </Pie>
          <Tooltip content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0];
            return (
              <div style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                <b>{d.name}</b>: {Number(d.value).toLocaleString()} ({total > 0 ? (d.value / total * 100).toFixed(1) : 0}%)
              </div>
            );
          }} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', justifyContent: 'center', marginTop: 4 }}>
        {chartData.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#4e5969' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            {d.name} <span style={{ color: '#86909c' }}>{total > 0 ? (d.value / total * 100).toFixed(1) : 0}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Language Usage (Progress Bars) ──
export function LanguageProgressBars({ data }: { data?: Array<{ language: string; count: number; percentage: number }> }) {
  if (!data?.length) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  const colors = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
      {data.map((d, i) => (
        <div key={d.language}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
            <span style={{ fontWeight: 500, color: '#1d2129' }}>{d.language}</span>
            <span style={{ color: '#86909c', fontSize: 12 }}>{d.count.toLocaleString()} <span style={{ color: '#c0c4cc' }}>({d.percentage}%)</span></span>
          </div>
          <div style={{ height: 8, background: '#f2f3f5', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${d.percentage}%`, background: colors[i % colors.length], transition: 'width 0.6s ease' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Difficulty Distribution (Bar Chart) ──
export function DifficultyBarChart({ data }: { data?: Array<{ difficulty: number; count: number }> }) {
  if (!data?.length) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  const chartData = data.map(d => ({ name: DIFFICULTY_NAMES[d.difficulty] || `${d.difficulty}`, count: d.count, color: DIFFICULTY_COLORS[d.difficulty] || '#94a3b8' }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey="count" name="题目数" radius={[6, 6, 0, 0]}>
          {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Hourly Activity (Bar Chart) ──
export function HourlyActivityChart({ data }: { data?: Array<{ hour: number; count: number }> }) {
  if (!data?.length) return <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  const currentHour = new Date().getHours();
  const chartData = data.map(d => ({ name: `${String(d.hour).padStart(2, '0')}`, count: d.count, isCurrent: d.hour === currentHour }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barCategoryGap="15%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#86909c' }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fontSize: 10, fill: '#86909c' }} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={({ active, payload, label }: any) => {
          if (!active || !payload?.length) return null;
          return (
            <div style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <b>{label}:00</b><br />提交: {payload[0].value} 次
            </div>
          );
        }} />
        <Bar dataKey="count" name="提交" radius={[3, 3, 0, 0]}>
          {chartData.map((d, i) => <Cell key={i} fill={d.isCurrent ? '#2563eb' : '#93c5fd'} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── User Growth (Line Chart) ──
export function UserGrowthChart({ data, cumulativeLabel = '累计用户' }: { data?: Array<{ month: string; cumulative: number }>; cumulativeLabel?: string }) {
  if (!data?.length) return <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#86909c' }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} />
        <Line type="monotone" dataKey="cumulative" name={cumulativeLabel} stroke="#8b5cf6" strokeWidth={2.5}
          dot={{ r: 4, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Top Problems ──
export function TopProblemsList({ data }: { data?: Array<{ problemId: number; title: string; difficulty: number; submissions: number; acRate: number }> }) {
  if (!data?.length) return <div style={{ padding: 20, textAlign: 'center', color: '#c0c4cc' }}>暂无数据</div>;
  const bgColors = ['#fef3c7', '#e0e7ff', '#fce7f3', '#f5f5f5', '#f5f5f5'];
  const textColors = ['#d97706', '#4f46e5', '#db2777', '#86909c', '#86909c'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {data.map((p, i) => (
        <div key={p.problemId} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
          borderBottom: i < data.length - 1 ? '1px solid #f5f5f5' : 'none',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: bgColors[i], color: textColors[i],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>{i + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1d2129', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.title}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: '#86909c' }}>
              <span>{p.submissions.toLocaleString()} 次提交</span>
              <span style={{
                padding: '1px 8px', borderRadius: 4, fontSize: 10, fontWeight: 500,
                background: `${DIFFICULTY_COLORS[p.difficulty] || '#94a3b8'}15`,
                color: DIFFICULTY_COLORS[p.difficulty] || '#94a3b8',
              }}>{DIFFICULTY_NAMES[p.difficulty] || p.difficulty}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: p.acRate >= 70 ? '#10b981' : p.acRate >= 40 ? '#f59e0b' : '#ef4444' }}>{p.acRate}%</div>
            <div style={{ fontSize: 10, color: '#c0c4cc' }}>通过率</div>
          </div>
        </div>
      ))}
    </div>
  );
}
