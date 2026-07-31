import { IconChevronRight } from '@douyinfe/semi-icons';
import type { LabFrame, LabModel, StructureDefinition } from './types';

const RANGE_TREE_KEYS = new Set(['segment-tree', 'lazy-segment-tree', 'dynamic-segment-tree', 'interval-tree', 'fenwick-tree', 'merge-sort-tree', 'wavelet-tree', 'range-tree', 'van-emde-boas']);

interface StructureVisualProps {
  definition: StructureDefinition;
  frame: LabFrame;
}

function isFocused(focusIds: string[], id: string) {
  return focusIds.includes(id);
}

function renderSequence(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  if (model.values.length === 0) return <div className="lab-visual-empty">当前结构为空</div>;
  return (
    <div className="lab-sequence-visual" role="img" aria-label={`${definition.name}，包含 ${model.values.length} 个元素`}>
      <div className="lab-sequence-indexes" aria-hidden="true">
        {model.values.map((_, index) => <span key={index}>index {index}</span>)}
      </div>
      <div className="lab-sequence-row">
        {model.values.map((value, index) => (
          <div className={`lab-sequence-cell ${isFocused(focusIds, `seq-${index}`) ? 'is-focused' : ''}`} key={`${value}-${index}`}>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="lab-sequence-caption">{definition.key === 'static-array' ? `固定容量：${model.capacity}` : definition.key === 'dynamic-array' || definition.key === 'vector' ? `当前容量：${model.capacity}，需要时可以扩容` : definition.key === 'sparse-array' ? '只保存有意义的元素位置，空位置不参与实际存储。' : '下标从 0 开始，元素顺序决定访问位置。'}</div>
    </div>
  );
}

function renderLinked(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  if (model.values.length === 0) return <div className="lab-visual-empty">当前链表为空</div>;
  const circular = definition.key.includes('circular');
  const doubly = definition.key.includes('doubly') || definition.key.includes('xor');
  return (
    <div className="lab-linked-visual" role="img" aria-label={`${definition.name}，包含 ${model.values.length} 个节点`}>
      <div className="lab-linked-caption"><span>head</span><span>{doubly ? 'prev / next 指针' : 'next 指针方向'}</span></div>
      <div className="lab-linked-row">
        {model.values.map((value, index) => (
          <div className="lab-linked-group" key={`${value}-${index}`}>
            <div className={`lab-linked-node ${isFocused(focusIds, `node-${index}`) ? 'is-focused' : ''}`}>
              <span className="lab-node-index">node {index}</span>
              <strong>{value}</strong>
              <span className="lab-node-next">{doubly ? 'prev · next' : definition.key.includes('xor') ? 'XOR' : 'next'}</span>
            </div>
            {index < model.values.length - 1 ? <IconChevronRight className="lab-linked-arrow" aria-hidden="true" /> : <span className="lab-null-pointer">{circular ? '↺ head' : 'null'}</span>}
          </div>
        ))}
      </div>
      {definition.key === 'unrolled-linked-list' ? <div className="lab-linked-footnote">每个节点内部还保存一小段连续元素。</div> : null}
      {definition.key === 'skip-list' ? <><div className="lab-linked-skip-row">{model.values.filter((_, index) => index % 2 === 0).map((value, index) => <span key={`${value}-${index}`}>{value}<small>express</small></span>)}</div><div className="lab-linked-footnote">上层索引跳过部分节点，下层保存完整链路。</div></> : null}
    </div>
  );
}

function renderStack(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const stack = (values: string[], label: string, prefix: string) => (
    <div className="lab-stack-column-wrap" key={label}>
      <div className="lab-stack-top-label"><span>{label}</span><span>后进先出</span></div>
      <div className="lab-stack-column">
        {values.length === 0 ? <div className="lab-visual-empty">为空</div> : [...values].reverse().map((value, reverseIndex) => {
          const index = values.length - reverseIndex - 1;
          return <div className={`lab-stack-item ${isFocused(focusIds, `${prefix}-${index}`) ? 'is-focused' : ''}`} key={`${value}-${index}`}><strong>{value}</strong><span>层级 {reverseIndex + 1}</span></div>;
        })}
      </div>
      <div className="lab-stack-base">STACK BASE</div>
    </div>
  );
  if (definition.key === 'two-stack') {
    const middle = Math.ceil(model.values.length / 2);
    return <div className="lab-dual-stack-visual" role="img" aria-label="两栈共享空间">{stack(model.values.slice(0, middle), 'STACK A', 'stack')}{stack(model.values.slice(middle), 'STACK B', 'stack')}</div>;
  }
  const numericValues = model.values.map(Number).filter(Number.isFinite);
  const extreme = numericValues.length > 0 ? (definition.key === 'min-stack' ? Math.min(...numericValues) : Math.max(...numericValues)) : undefined;
  return <div className="lab-stack-visual" role="img" aria-label={`${definition.name}，当前有 ${model.values.length} 个元素`}>{stack(model.values, 'TOP', 'stack')}<div className="lab-stack-note">{definition.key === 'min-stack' ? `辅助信息：当前最小值为 ${extreme ?? '空'}。` : definition.key === 'max-stack' ? `辅助信息：当前最大值为 ${extreme ?? '空'}。` : definition.key === 'monotonic-stack' ? '保持从栈底到栈顶单调递增。' : '最后进入的元素最先离开。'}</div></div>;
}

function renderQueue(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const circular = definition.key.includes('circular') || definition.key === 'ring-buffer';
  const deque = definition.key === 'deque';
  return (
    <div className="lab-queue-visual" role="img" aria-label={`${definition.name}，当前有 ${model.values.length} 个元素`}>
      <div className="lab-queue-labels"><span>{deque ? 'LEFT / 出队' : 'HEAD / 出队'}</span><span>{deque ? 'RIGHT / 入队' : 'TAIL / 入队'}</span></div>
      {model.values.length === 0 ? <div className="lab-visual-empty">当前队列为空</div> : (
        <div className="lab-queue-row">
          {model.values.map((value, index) => (
            <div className={`lab-queue-cell ${isFocused(focusIds, `queue-${index}`) ? 'is-focused' : ''}`} key={`${value}-${index}`}>
              <span>{index}</span><strong>{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="lab-queue-direction"><IconChevronRight aria-hidden="true" /> {circular ? `到达末尾后回到开头（head=${model.headIndex}，tail=${model.tailIndex}，容量=${model.capacity}）` : '数据流动方向'}</div>
    </div>
  );
}

function renderHash(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const strategy = definition.key.includes('chained') || ['hash-table', 'hash-set', 'hash-map', 'multiset', 'multimap'].includes(definition.key) ? '链地址法：冲突键挂在同一个桶中' : definition.key === 'cuckoo-hash' ? '布谷鸟哈希：每个键有两个候选桶' : definition.key === 'direct-address-table' ? '直接寻址：键直接决定槽位' : '开放寻址：沿探测序列寻找空槽';
  return (
    <div className="lab-hash-visual" role="img" aria-label={`${definition.name}，包含 ${model.buckets.length} 个哈希桶`}>
      {model.buckets.map((bucket) => (
        <div className={`lab-hash-bucket ${isFocused(focusIds, `bucket-${bucket.index}`) ? 'is-focused' : ''}`} key={bucket.index}>
          <span className="lab-hash-index">bucket {bucket.index}</span>
          <div className="lab-hash-entries">{bucket.entries.length > 0 ? bucket.entries.map((entry, index) => <span key={`${entry}-${index}`}>{entry}</span>) : <em>empty</em>}</div>
        </div>
      ))}
      <div className="lab-hash-caption">{strategy}</div>
    </div>
  );
}

function renderBits(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  return (
    <div className="lab-bits-visual" role="img" aria-label={`${definition.name}，展示 ${model.bits.length} 个二进制位`}>
      <div className="lab-bits-row">
        {model.bits.map((bit, index) => <div className={`lab-bit-cell ${bit ? 'is-on' : ''} ${isFocused(focusIds, `bit-${index}`) ? 'is-focused' : ''}`} key={index}><span>{index}</span><strong>{bit}</strong></div>)}
      </div>
      <div className="lab-bits-caption">左侧是低下标，亮起的格子表示当前集合或过滤器中可能存在。</div>
    </div>
  );
}

function renderFilter(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  return (
    <div className="lab-bits-visual" role="img" aria-label={`${definition.name}，展示 ${model.bits.length} 个哈希槽位`}>
      <div className="lab-bits-row">
        {model.bits.map((bit, index) => <div className={`lab-bit-cell ${bit ? 'is-on' : ''} ${isFocused(focusIds, `bit-${index}`) ? 'is-focused' : ''}`} key={index}><span>slot {index}</span><strong>{bit ? (definition.key === 'cuckoo-filter' ? 'fp' : '1') : '0'}</strong></div>)}
      </div>
      <div className="lab-bits-caption">每个键会映射到多个槽位；查询时只要发现一个 0，就能确定键不存在。</div>
    </div>
  );
}

function renderSketch(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const max = Math.max(...model.counters, 1);
  return (
    <div className="lab-sketch-visual" role="img" aria-label={`${definition.name}，展示多个计数器`}>
      {model.counters.map((count, index) => <div className={`lab-counter-row ${isFocused(focusIds, `counter-${index}`) ? 'is-focused' : ''}`} key={index}><span>{definition.key === 'hyperloglog' ? 'register' : 'hash'} {index}</span><div className="lab-counter-track"><i style={{ width: `${Math.max(4, (count / max) * 100)}%` }} /></div><strong>{count}</strong></div>)}
      <div className="lab-bits-caption">{definition.key === 'hyperloglog' ? 'HyperLogLog 保存寄存器的最大等级，用来估计不同元素的数量。' : '多个哈希位置共同记录样本；同一个位置可能被不同样本共享。'}</div>
    </div>
  );
}

function renderTree(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const levels = Array.from(new Set(model.nodes.map((node) => node.depth))).sort((a, b) => a - b);
  if (model.nodes.length === 0) return <div className="lab-visual-empty">当前树为空</div>;
  return (
    <div className="lab-tree-visual" role="img" aria-label={`${definition.name}，包含 ${model.nodes.length} 个节点`}>
      {levels.map((depth) => (
        <div className="lab-tree-level" key={depth}>
          <span className="lab-tree-depth">level {depth}</span>
          <div className="lab-tree-nodes">
            {model.nodes.filter((node) => node.depth === depth).map((node) => <div className={`lab-tree-node ${node.color ? `is-${node.color}` : ''} ${isFocused(focusIds, node.id) ? 'is-focused' : ''}`} key={node.id}><strong>{node.label}</strong><small>{node.parentId ? `parent: ${model.nodes.find((item) => item.id === node.parentId)?.label ?? '?'}` : 'root'}{node.color ? ` · ${node.color}` : ''}{node.priority !== undefined ? ` · p=${node.priority}` : ''}{definition.key === 'order-statistic-tree' && node.size !== undefined ? ` · size=${node.size}` : ''}</small></div>)}
          </div>
        </div>
      ))}
      <div className="lab-tree-relations">{model.nodes.filter((node) => node.parentId).slice(0, 18).map((node) => <span key={`${node.parentId}-${node.id}`}>{model.nodes.find((item) => item.id === node.parentId)?.label ?? '?'} <b>→</b> {node.label}</span>)}</div>
      <div className="lab-tree-caption">{definition.key.includes('red-black') ? '红黑树：红色节点不能相邻，根节点保持黑色。' : definition.key.includes('avl') ? 'AVL 树：每个节点左右子树高度差不超过 1。' : definition.key === 'splay' ? '伸展树：刚访问的节点会通过旋转移动到根，帮助适应热点访问。' : definition.key === 'treap' ? 'Treap 同时保持搜索树顺序和堆的优先级。' : RANGE_TREE_KEYS.has(definition.key) ? '每个节点表示一个范围；父范围继续拆成更小的子范围。' : definition.key.includes('b-plus') ? 'B+ 树：数据集中在叶子层，内部节点保存导航键。' : definition.key.includes('b-tree') || definition.key.includes('two-three') ? '多路树：一个节点可以保存多个键，并拥有多个子节点。' : definition.key.includes('merkle') ? 'Merkle 树：父节点由子节点摘要组合得到。' : '每一行是一层；箭头和 parent 标签共同表示父子关系。'}</div>
    </div>
  );
}

function renderHeap(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const arity = definition.key === 'd-ary-heap' ? 3 : 2;
  const levels: string[][] = [];
  model.values.forEach((value, index) => {
    let depth = 0;
    let levelStart = 0;
    let levelWidth = 1;
    while (index >= levelStart + levelWidth) {
      levelStart += levelWidth;
      levelWidth *= arity;
      depth += 1;
    }
    if (!levels[depth]) levels[depth] = [];
    levels[depth].push(value);
  });
  return (
    <div className="lab-heap-visual" role="img" aria-label={`${definition.name}，堆顶为 ${model.values[0] ?? '空'}`}>
      {levels.map((level, depth) => <div className="lab-heap-level" key={depth}>{level.map((value, offset) => { const index = (arity ** depth - 1) / (arity - 1) + offset; return <div className={`lab-heap-node ${isFocused(focusIds, `heap-${index}`) ? 'is-focused' : ''}`} key={`${value}-${index}`}><strong>{value}</strong><small>index {index}</small></div>; })}</div>)}
      {model.values.length === 0 ? <div className="lab-visual-empty">堆为空</div> : null}
      <div className="lab-tree-caption">{definition.key === 'd-ary-heap' ? '这是 3 叉堆：每个节点最多有 3 个孩子。' : definition.key === 'min-max-heap' ? '最小层和最大层交替出现，支持两端优先级操作。' : definition.key === 'interval-heap' ? '每个节点保存一个区间，同时维护最小端和最大端。' : '堆顶位于第一层；每个父节点都遵守当前堆的优先级规则。'}</div>
    </div>
  );
}

function renderTrie(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const levels = Array.from(new Set(model.trieNodes.map((node) => node.depth))).sort((a, b) => a - b);
  return (
    <div className="lab-trie-visual" role="img" aria-label={`${definition.name}，包含 ${model.trieNodes.length} 个字符节点`}>
      {levels.map((depth) => <div className="lab-tree-level" key={depth}><span className="lab-tree-depth">depth {depth}</span><div className="lab-tree-nodes">{model.trieNodes.filter((node) => node.depth === depth).map((node) => <div className={`lab-trie-node ${node.terminal ? 'is-terminal' : ''} ${isFocused(focusIds, node.id) ? 'is-focused' : ''}`} key={node.id}><strong>{node.label}</strong><small>{node.terminal ? '单词终点' : '前缀'}</small></div>)}</div></div>)}
      <div className="lab-tree-caption">同一层的字符可以共享相同前缀；带“单词终点”标记的节点代表一个完整单词。</div>
    </div>
  );
}

function graphPositions(vertices: string[]) {
  return new Map(vertices.map((vertex, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(vertices.length, 1) - Math.PI / 2;
    return [vertex, { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 34 }];
  }));
}

function renderGraph(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const positions = graphPositions(model.vertices);
  const directed = ['directed-graph', 'dag', 'forward-star', 'inverse-adjacency-list'].includes(definition.key);
  const weighted = definition.key === 'weighted-graph' || definition.key === 'minimum-spanning-tree';
  const isMatrixRepresentation = ['adjacency-matrix', 'incidence-matrix'].includes(definition.key);
  return (
    <div className="lab-graph-visual" role="img" aria-label={`${definition.name}，包含 ${model.vertices.length} 个顶点和 ${model.edges.length} 条边`}>
      <svg viewBox="0 0 100 100" className="lab-graph-svg" aria-hidden="true">
        <defs><marker id="lab-graph-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" /></marker></defs>
        {model.edges.map((edge) => { const from = positions.get(edge.from); const to = positions.get(edge.to); if (!from || !to) return null; return <g key={edge.id} className={isFocused(focusIds, edge.id) ? 'is-focused' : ''}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd={directed ? 'url(#lab-graph-arrow)' : undefined} /><text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2}>{weighted ? edge.weight : ''}</text></g>; })}
        {model.vertices.map((vertex) => { const point = positions.get(vertex)!; return <g key={vertex} className={isFocused(focusIds, `vertex-${vertex}`) || model.visited.includes(vertex) ? 'is-focused' : ''}><circle cx={point.x} cy={point.y} r="6" /><text x={point.x} y={point.y + 1}>{vertex}</text></g>; })}
      </svg>
      <div className="lab-graph-legend"><span>圆点：顶点</span><span>线段：边</span>{directed ? <span>箭头：方向</span> : null}{weighted ? <span>数字：权重</span> : null}</div>
      {isMatrixRepresentation ? <div className="lab-graph-representation"><strong>{definition.name}的表格表示</strong><table><tbody>{model.matrix.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td key={columnIndex}>{value}</td>)}</tr>)}</tbody></table></div> : model.rows.length > 0 ? <div className="lab-graph-representation"><strong>存储表示</strong>{model.rows.map((row) => <span key={row}>{row}</span>)}</div> : null}
    </div>
  );
}

function renderDsu(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const groups = new Map<number, number[]>();
  model.parents.forEach((_, index) => { let root = index; while (model.parents[root] !== root && model.parents[root] !== undefined) root = model.parents[root]; if (!groups.has(root)) groups.set(root, []); groups.get(root)!.push(index); });
  return (
    <div className="lab-dsu-visual" role="img" aria-label={`${definition.name}，展示 ${model.parents.length} 个元素的 parent 关系`}>
      <div className="lab-dsu-parent-row">{model.parents.map((parent, index) => <div className={`lab-dsu-item ${isFocused(focusIds, `dsu-${index}`) ? 'is-focused' : ''}`} key={index}><strong>{index}</strong><span>parent → {parent}</span></div>)}</div>
      <div className="lab-dsu-groups">{Array.from(groups.entries()).map(([root, members]) => <span key={root}>代表元 {root}：{members.join(', ')}</span>)}</div>
    </div>
  );
}

function renderText(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  const useTokens = definition.key === 'string-array';
  const characters = useTokens ? model.text.split(/\s+/).filter(Boolean) : [...model.text];
  return (
    <div className="lab-text-visual" role="img" aria-label={`${definition.name}，当前文本长度 ${model.text.length}`}>
      <div className="lab-text-row">{characters.length > 0 ? characters.map((character, index) => <div className={`lab-text-cell ${isFocused(focusIds, `char-${index}`) ? 'is-focused' : ''}`} key={`${character}-${index}`}><span>{index}</span><strong>{character}</strong></div>) : <div className="lab-visual-empty">文本为空</div>}</div>
      {model.rows.length > 0 ? <div className="lab-text-index"><strong>索引视图</strong>{model.rows.map((row) => <span key={row}>{row}</span>)}</div> : null}
    </div>
  );
}

function renderMatrix(definition: StructureDefinition, model: LabModel, focusIds: string[]) {
  return (
    <div className="lab-matrix-visual" role="img" aria-label={`${definition.name}，${model.matrix.length} 行 ${model.matrix[0]?.length ?? 0} 列`}>
      <table><tbody>{model.matrix.map((row, rowIndex) => <tr key={rowIndex}>{row.map((value, columnIndex) => <td className={isFocused(focusIds, `cell-${rowIndex}-${columnIndex}`) ? 'is-focused' : ''} key={columnIndex}><span>{rowIndex},{columnIndex}</span><strong>{value}</strong></td>)}</tr>)}</tbody></table>
      {model.rows.length > 0 ? <div className="lab-matrix-rows"><strong>压缩存储视图</strong>{model.rows.map((row) => <span key={row}>{row}</span>)}</div> : null}
      <div className="lab-matrix-caption">单元格标签为“行,列”，例如 1,2 表示第 1 行第 2 列。</div>
    </div>
  );
}

export function StructureVisual({ definition, frame }: StructureVisualProps) {
  const { model, focusIds } = frame;
  switch (definition.visualFamily) {
    case 'sequence': return renderSequence(definition, model, focusIds);
    case 'linked': return renderLinked(definition, model, focusIds);
    case 'stack': return renderStack(definition, model, focusIds);
    case 'queue': return renderQueue(definition, model, focusIds);
    case 'hash': return renderHash(definition, model, focusIds);
    case 'bits': return renderBits(definition, model, focusIds);
    case 'filter': return renderFilter(definition, model, focusIds);
    case 'sketch': return renderSketch(definition, model, focusIds);
    case 'tree': return renderTree(definition, model, focusIds);
    case 'heap': return renderHeap(definition, model, focusIds);
    case 'trie': return renderTrie(definition, model, focusIds);
    case 'graph': return renderGraph(definition, model, focusIds);
    case 'dsu': return renderDsu(definition, model, focusIds);
    case 'text': return renderText(definition, model, focusIds);
    case 'matrix': return renderMatrix(definition, model, focusIds);
    default: return <div className="lab-visual-empty">当前结构暂无可视化</div>;
  }
}
