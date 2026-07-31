import{m as S,r as p,p as I,j as e,T as a}from"./index-CjEuB_Aq.js";import{B as k}from"./index-VgqGkd4m.js";import{B}from"./index-BOfHQ7uh.js";import{C as T}from"./index-DJzC9TRx.js";import{S as C}from"./index-BNJqNuTR.js";import{T as c}from"./index-CxiGwwIF.js";import{I as W,a as z}from"./IconTreeTriangleDown-Dkia71Jx.js";import"./IconClose-Dl7Dhu4-.js";import"./IconTickCircle-K_ckxICg.js";import"./constants-CM3vpuO1.js";import"./index-DJGO3l4o.js";import"./isNumber-CxM_BkBT.js";function A(o){return o==="RUNNING"?"进行中":o==="ENDED"?"已结束":"未开始"}function N(o,i,t,l){return o?"scoreboard-cell-accepted":l==="OI"&&t>0?"scoreboard-cell-partial":i>0?"scoreboard-cell-failed":"scoreboard-cell-empty"}function $(o){return"个人"}function D(o){return o==="GOLD"?e.jsx(c,{color:"orange",children:"金"}):o==="SILVER"?e.jsx(c,{color:"grey",children:"银"}):o==="BRONZE"?e.jsx(c,{color:"yellow",children:"铜"}):e.jsx(a.Text,{type:"tertiary",children:"-"})}function E(o,i){return i?"打星":o??"-"}function m(o){return o.contestProblemId??o.problemId}function y(o){const i=new Date(o),t=i.getFullYear(),l=String(i.getMonth()+1).padStart(2,"0"),x=String(i.getDate()).padStart(2,"0"),d=String(i.getHours()).padStart(2,"0"),g=String(i.getMinutes()).padStart(2,"0");return`${t}-${l}-${x} ${d}:${g}`}function X(){const{contestId:o}=S(),i=Number(o??0),[t,l]=p.useState(null),[x,d]=p.useState(!0),[g,h]=p.useState("");return p.useEffect(()=>{if(!i){h("比赛不存在"),d(!1);return}d(!0),I(i).then(l).catch(r=>h(r instanceof Error?r.message:"榜单加载失败")).finally(()=>d(!1))},[i]),x?e.jsx("div",{style:{display:"grid",placeItems:"center",minHeight:"50vh"},children:e.jsx(C,{tip:"榜单加载中"})}):t?e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:20},children:[e.jsx(B,{icon:e.jsx(W,{}),theme:"borderless",onClick:()=>{window.location.href="/contests"},children:"返回比赛"}),e.jsx(T,{style:{border:"1px solid var(--semi-color-border)"},bodyStyle:{padding:24,display:"flex",flexDirection:"column",gap:16},children:e.jsxs("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"flex-start",justifyContent:"space-between",gap:16},children:[e.jsxs("div",{children:[e.jsxs("div",{style:{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8},children:[e.jsx(c,{color:"blue",children:t.type}),e.jsx(c,{children:A(t.status)})]}),e.jsx(a.Title,{heading:2,style:{marginTop:12,marginBottom:0},children:t.title}),e.jsxs(a.Text,{type:"tertiary",style:{marginTop:8,display:"block",fontSize:14},children:[y(t.startTime)," - ",y(t.endTime)," · ",t.durationMinutes," 分钟"]})]}),e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8,borderRadius:8,backgroundColor:"var(--semi-color-warning-light-default)",padding:"12px 16px",color:"var(--semi-color-warning-dark)"},children:[e.jsx(z,{size:"large"}),e.jsx(a.Text,{style:{fontSize:14,fontWeight:500},children:"Public Scoreboard"})]})]})}),e.jsx("div",{style:{overflowX:"auto",borderRadius:8,border:"1px solid var(--semi-color-border)",background:"var(--semi-color-bg-0)"},children:e.jsxs("table",{style:{minWidth:"100%",borderCollapse:"collapse",fontSize:14},children:[e.jsx("thead",{children:e.jsxs("tr",{style:{backgroundColor:"var(--semi-color-fill-1)"},children:[e.jsx("th",{style:{position:"sticky",left:0,zIndex:10,backgroundColor:"var(--semi-color-fill-1)",borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"left",fontWeight:600},children:"Rank"}),e.jsx("th",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center",fontWeight:600},children:"Medal"}),e.jsx("th",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px 16px",textAlign:"left",fontWeight:600},children:"User"}),e.jsx("th",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center",fontWeight:600},children:"Solved"}),e.jsx("th",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center",fontWeight:600},children:t.type==="OI"?"Score":"Penalty"}),t.problems.map(r=>e.jsxs("th",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center",fontWeight:600},title:r.title,children:[e.jsx("div",{children:r.label}),t.type==="OI"&&e.jsx("div",{style:{marginTop:2,fontSize:11,fontWeight:400,color:"var(--semi-color-text-2)"},children:r.score??0})]},m(r)))]})}),e.jsxs("tbody",{children:[t.rows.map(r=>e.jsxs("tr",{className:"scoreboard-row",children:[e.jsx("td",{style:{position:"sticky",left:0,zIndex:10,backgroundColor:"var(--semi-color-bg-0)",borderBottom:"1px solid var(--semi-color-border)",padding:"12px",fontWeight:600},children:E(r.rank,r.starred)}),e.jsx("td",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center"},children:D(r.medal)}),e.jsx("td",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px 16px",fontWeight:500},children:e.jsxs("div",{style:{display:"flex",flexDirection:"column",gap:4},children:[e.jsx("span",{children:r.displayName||r.userId}),e.jsxs(a.Text,{type:"tertiary",style:{fontSize:12},children:[$(r.identityType),r.starred?" · 打星":""]})]})}),e.jsx("td",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center"},children:r.solved}),e.jsx("td",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"12px",textAlign:"center",fontWeight:600},children:t.type==="OI"?r.score:r.penalty}),t.problems.map(j=>{const f=m(j),s=r.cells.find(v=>m(v)===f),n=(s==null?void 0:s.attempts)??0,u=!!(s!=null&&s.accepted),b=(s==null?void 0:s.score)??0;return e.jsx("td",{style:{borderBottom:"1px solid var(--semi-color-border)",padding:"8px",textAlign:"center"},children:e.jsx("div",{className:N(u,n,b,t.type),children:t.type==="OI"?n>0?b:"-":u?`+${n>1?n-1:""}`:n>0?`-${n}`:"-"})},f)})]},`${r.identityType??"PERSONAL"}-${r.identityId??r.userId}`)),t.rows.length===0&&e.jsx("tr",{children:e.jsx("td",{colSpan:5+t.problems.length,style:{padding:"48px 16px",textAlign:"center",color:"var(--semi-color-text-2)"},children:"暂无提交数据"})})]})]})}),e.jsx("style",{children:`
        .scoreboard-row:hover {
          background-color: var(--semi-color-fill-0);
        }
        .scoreboard-row:hover td:first-child {
          background-color: var(--semi-color-fill-0);
        }
        .scoreboard-cell-accepted {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-success-light-default);
          color: var(--semi-color-success-dark);
        }
        .scoreboard-cell-partial {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-warning-light-default);
          color: var(--semi-color-warning-dark);
        }
        .scoreboard-cell-failed {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-danger-light-default);
          color: var(--semi-color-danger-dark);
        }
        .scoreboard-cell-empty {
          margin: 0 auto;
          min-width: 56px;
          border-radius: 6px;
          padding: 6px 8px;
          fontSize: 12px;
          fontWeight: 600;
          backgroundColor: var(--semi-color-fill-0);
          color: var(--semi-color-text-2);
        }
      `})]}):e.jsx(k,{type:"danger",description:g||"榜单不存在",closeIcon:null})}export{X as ContestScoreboardPage};
