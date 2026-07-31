import type {
  LabCategory,
  OperationDefinition,
  StructureDefinition,
  VisualFamily,
} from './types';

const numberField = (key: 'value' | 'index' | 'row' | 'column', label: string, placeholder: string): NonNullable<OperationDefinition['fields']> => [
  { key, label, placeholder, type: 'number' },
];

const textField = (key: 'key' | 'text' | 'start' | 'end', label: string, placeholder: string): NonNullable<OperationDefinition['fields']> => [
  { key, label, placeholder, type: 'text' },
];

const valueField = numberField('value', '元素值', '例如：72');
const indexField = numberField('index', '下标', '例如：2');
const keyField = textField('key', '键 / 目标', '例如：42');
const wordField = textField('text', '字符串 / 单词', '例如：DATA');

const OPERATIONS: Record<VisualFamily, OperationDefinition[]> = {
  sequence: [
    { key: 'append', label: '尾部添加', description: '把一个元素放到当前结构的末尾。', fields: valueField },
    { key: 'insert', label: '指定位置插入', description: '在指定位置插入一个元素，其后的元素会移动。', fields: [...valueField, ...indexField] },
    { key: 'delete', label: '删除元素', description: '删除指定位置的元素。', fields: indexField },
    { key: 'find', label: '顺序查找', description: '从左到右逐个检查元素，直到找到目标。', fields: valueField },
    { key: 'reverse', label: '原地反转', description: '交换两端元素，逐步把序列反转。' },
  ],
  linked: [
    { key: 'head-insert', label: '头部插入', description: '把新节点接到 head 前面。', fields: valueField },
    { key: 'tail-insert', label: '尾部插入', description: '把新节点接到链表尾部。', fields: valueField },
    { key: 'delete', label: '删除节点', description: '找到目标节点并重新连接前后指针。', fields: valueField },
    { key: 'find', label: '遍历查找', description: '沿着 next 指针逐个访问节点。', fields: valueField },
    { key: 'reverse', label: '反转指针', description: '逐个翻转 next 指针的方向。' },
  ],
  stack: [
    { key: 'push', label: '入栈', description: '把元素放到栈顶。', fields: valueField },
    { key: 'pop', label: '出栈', description: '移除并返回栈顶元素。' },
    { key: 'peek', label: '查看栈顶', description: '读取栈顶但不移除元素。' },
  ],
  queue: [
    { key: 'enqueue', label: '入队', description: '把元素放到队尾。', fields: valueField },
    { key: 'dequeue', label: '出队', description: '移除并返回队首元素。' },
    { key: 'peek', label: '查看队首', description: '读取队首但不移除元素。' },
  ],
  hash: [
    { key: 'set', label: '写入键', description: '计算哈希位置并写入一个键。', fields: keyField },
    { key: 'find', label: '查找键', description: '沿哈希桶或探测序列查找目标键。', fields: keyField },
    { key: 'delete', label: '删除键', description: '找到目标键并从哈希结构中移除。', fields: keyField },
  ],
  bits: [
    { key: 'set-bit', label: '置位', description: '把指定位置改为 1。', fields: indexField },
    { key: 'clear-bit', label: '清零', description: '把指定位置改为 0。', fields: indexField },
    { key: 'query-bit', label: '查询位', description: '读取指定位置当前是 0 还是 1。', fields: indexField },
  ],
  filter: [
    { key: 'add', label: '加入键', description: '用多个哈希位置记录一个键可能出现的位置。', fields: keyField },
    { key: 'query', label: '查询键', description: '检查所有候选位置；只要有一位为 0 就一定不存在。', fields: keyField },
    { key: 'clear', label: '清空过滤器', description: '清除所有标记，回到空过滤器。' },
  ],
  sketch: [
    { key: 'add', label: '加入样本', description: '用多个哈希函数更新计数器。', fields: keyField },
    { key: 'query', label: '估计频率', description: '读取多个计数器的最小值作为估计。', fields: keyField },
  ],
  tree: [
    { key: 'insert', label: '插入节点', description: '沿树的规则找到位置并加入新节点。', fields: valueField },
    { key: 'find', label: '查找节点', description: '按照树的层级或比较规则访问节点。', fields: valueField },
    { key: 'delete', label: '删除节点', description: '删除目标节点并处理它的子树。', fields: valueField },
    { key: 'traverse', label: '层序遍历', description: '从根开始按层访问所有节点。' },
  ],
  heap: [
    { key: 'insert', label: '插入元素', description: '加入末尾后向上调整堆。', fields: valueField },
    { key: 'extract', label: '取出优先元素', description: '移除堆顶后向下调整堆。' },
    { key: 'peek', label: '查看堆顶', description: '读取当前优先级最高的元素。' },
  ],
  trie: [
    { key: 'insert-word', label: '插入单词', description: '沿字符路径创建或复用节点。', fields: wordField },
    { key: 'find-word', label: '查找单词', description: '沿字符路径检查每个字符是否存在。', fields: wordField },
    { key: 'delete-word', label: '删除单词', description: '取消单词终点标记，必要时清理孤立节点。', fields: wordField },
  ],
  graph: [
    { key: 'add-edge', label: '添加边', description: '在两个顶点之间建立一条边。', fields: [...textField('start', '起点', '例如：A'), ...textField('end', '终点', '例如：B')] },
    { key: 'bfs', label: '广度优先遍历', description: '使用队列，一层一层访问顶点。' },
    { key: 'dfs', label: '深度优先遍历', description: '沿一条路径深入，再回溯到分叉点。' },
  ],
  dsu: [
    { key: 'union', label: '合并集合', description: '把两个元素所在的集合连接起来。', fields: [...numberField('row', '元素 A', '例如：0'), ...numberField('column', '元素 B', '例如：1')] },
    { key: 'find-set', label: '查找代表元', description: '沿父节点找到集合代表，并演示路径压缩。', fields: numberField('index', '元素', '例如：3') },
  ],
  text: [
    { key: 'append', label: '追加文本', description: '把一段文本加入当前字符串。', fields: wordField },
    { key: 'search', label: '查找子串', description: '在文本中查找目标字符串的位置。', fields: wordField },
    { key: 'clear', label: '清空文本', description: '移除当前文本并回到空状态。' },
  ],
  matrix: [
    { key: 'set-cell', label: '修改单元格', description: '修改指定行列位置的值。', fields: [...numberField('row', '行', '例如：1'), ...numberField('column', '列', '例如：1'), ...valueField] },
    { key: 'read-cell', label: '读取单元格', description: '高亮并读取指定行列位置的值。', fields: [...numberField('row', '行', '例如：1'), ...numberField('column', '列', '例如：1')] },
    { key: 'transpose', label: '转置矩阵', description: '交换矩阵的行和列。' },
  ],
};

const DEQUE_OPERATIONS: OperationDefinition[] = [
  { key: 'push-left', label: '左端插入', description: '把元素放到双端队列左端。', fields: valueField },
  { key: 'push-right', label: '右端插入', description: '把元素放到双端队列右端。', fields: valueField },
  { key: 'pop-left', label: '左端删除', description: '移除双端队列左端元素。' },
  { key: 'pop-right', label: '右端删除', description: '移除双端队列右端元素。' },
  { key: 'peek', label: '查看两端', description: '同时观察双端队列的左右端元素。' },
];

const RANGE_FIELDS: NonNullable<OperationDefinition['fields']> = [
  { key: 'start', label: '范围起点', placeholder: '例如：1', type: 'number' },
  { key: 'end', label: '范围终点', placeholder: '例如：4', type: 'number' },
];

const RANGE_OPERATIONS: OperationDefinition[] = [
  { key: 'query-range', label: '查询范围', description: '沿树访问与目标范围相关的节点，并合并子范围结果。', fields: RANGE_FIELDS },
  { key: 'update-point', label: '更新单点', description: '修改一个叶子位置，再沿父节点回溯更新聚合值。', fields: [...indexField, ...valueField] },
  { key: 'traverse', label: '层序遍历', description: '按层观察范围如何逐步拆分。' },
];

const RANGE_STRUCTURE_KEYS = new Set(['segment-tree', 'lazy-segment-tree', 'dynamic-segment-tree', 'interval-tree', 'fenwick-tree', 'merge-sort-tree', 'wavelet-tree', 'range-tree', 'van-emde-boas']);

function operationsFor(key: string, visualFamily: VisualFamily) {
  if (key === 'deque') return DEQUE_OPERATIONS;
  if (RANGE_STRUCTURE_KEYS.has(key)) return RANGE_OPERATIONS;
  return OPERATIONS[visualFamily];
}

const FAMILY_DEFAULTS: Record<VisualFamily, { defaultInput: string; inputHint: string; description: string; learn: string; complexity: string }> = {
  sequence: {
    defaultInput: '12, 27, 36, 44, 58',
    inputHint: '输入数字，用逗号或空格分隔。',
    description: '元素按顺序排列，可以观察位置、移动和访问。',
    learn: '关注下标、顺序和元素移动。',
    complexity: '访问 O(1) 或 O(n)，插入 / 删除通常需要移动元素。',
  },
  linked: {
    defaultInput: '12, 27, 36, 44, 58',
    inputHint: '输入数字，用逗号或空格分隔，画布会展示节点和指针。',
    description: '节点不必连续存储，指针负责把节点连接起来。',
    learn: '关注 head、tail、next 和指针重连。',
    complexity: '按位置访问 O(n)，已知节点位置时插入 / 删除更灵活。',
  },
  stack: {
    defaultInput: '12, 27, 36, 44',
    inputHint: '输入数字，用逗号或空格分隔；栈顶位于最上方。',
    description: '栈遵循后进先出（LIFO），所有操作都围绕栈顶。',
    learn: '观察 TOP、入栈顺序和出栈顺序。',
    complexity: '入栈、出栈、查看栈顶通常都是 O(1)。',
  },
  queue: {
    defaultInput: '12, 27, 36, 44',
    inputHint: '输入数字，用逗号或空格分隔；队首从左侧离开。',
    description: '队列遵循先进先出（FIFO），从队尾进入、队首离开。',
    learn: '观察 HEAD、TAIL 和数据流动方向。',
    complexity: '合理实现时入队、出队、查看队首通常都是 O(1)。',
  },
  hash: {
    defaultInput: '12, 27, 36, 44, 58',
    inputHint: '输入数字或文本键，观察哈希位置与冲突处理。',
    description: '哈希函数把键映射到桶，冲突时需要额外的处理策略。',
    learn: '观察哈希值、桶下标、冲突和探测路径。',
    complexity: '平均查找接近 O(1)，冲突严重时可能退化。',
  },
  bits: {
    defaultInput: '1, 3, 5, 8',
    inputHint: '输入要置位的下标，画布展示二进制位。',
    description: '用一个个 0 / 1 表示集合中的状态，空间利用率很高。',
    learn: '观察位下标、位值和按位状态变化。',
    complexity: '设置、清除和查询单个位通常都是 O(1)。',
  },
  filter: {
    defaultInput: 'apple, banana, apple, tree',
    inputHint: '输入多个键，用逗号或空格分隔；过滤器只保证“不存在”判断可靠。',
    description: '过滤器用多个哈希位置记录“可能存在”的键，节省空间但可能误报。',
    learn: '观察多个哈希位置，以及“有 0 就一定不存在”的判断规则。',
    complexity: '加入和查询速度稳定，结果可能有误报但不会漏报（以布隆过滤器为例）。',
  },
  sketch: {
    defaultInput: 'apple, banana, apple, tree, apple',
    inputHint: '输入样本键，观察计数器如何被多个哈希函数更新。',
    description: '概率型结构用少量空间换取快速的近似统计。',
    learn: '观察多个哈希位置和“可能高估、不可能低估”的特点。',
    complexity: '更新和查询速度稳定，但结果是近似值。',
  },
  tree: {
    defaultInput: '50, 30, 70, 20, 40, 60, 80',
    inputHint: '输入数字，用逗号或空格分隔；节点会按层展示。',
    description: '树通过父子关系表达层次，根在最上方，叶子没有孩子。',
    learn: '观察根、父节点、子节点、叶子和层序关系。',
    complexity: '取决于树高；平衡树通常能保持 O(log n)。',
  },
  heap: {
    defaultInput: '42, 18, 35, 7, 26, 13',
    inputHint: '输入数字，画布会按堆的层次展示优先级关系。',
    description: '堆保持局部有序，堆顶总是当前优先级最高的元素。',
    learn: '观察向上调整、向下调整和父子大小关系。',
    complexity: '插入、取堆顶和删除堆顶通常是 O(log n)。',
  },
  trie: {
    defaultInput: 'DATA, TREE, TRIE',
    inputHint: '输入多个单词，用逗号或空格分隔。',
    description: '字典树按字符共享前缀，适合单词查找和前缀匹配。',
    learn: '观察字符节点、共享前缀和单词终点标记。',
    complexity: '操作复杂度主要取决于单词长度，而不是单词数量。',
  },
  graph: {
    defaultInput: 'A, B, C, D, E',
    inputHint: '输入顶点名称；添加边时使用起点和终点字段。',
    description: '图由顶点和边组成，可以表达网络、依赖和路径关系。',
    learn: '观察顶点、边、访问顺序和已访问标记。',
    complexity: '遍历通常为 O(V + E)，其中 V 是顶点数、E 是边数。',
  },
  dsu: {
    defaultInput: '0, 1, 2, 3, 4, 5',
    inputHint: '输入元素编号，合并操作会展示代表元变化。',
    description: '并查集把元素划分为若干集合，并快速判断连通关系。',
    learn: '观察 parent、代表元、按秩合并和路径压缩。',
    complexity: '配合优化后，连续操作的均摊复杂度接近 O(1)。',
  },
  text: {
    defaultInput: 'DATA STRUCTURE',
    inputHint: '输入文本或单词，观察字符位置、子串和索引。',
    description: '字符串结构把文本组织成可搜索、可切分、可索引的序列。',
    learn: '观察字符位置、匹配范围和文本索引。',
    complexity: '通常与文本长度和模式长度有关。',
  },
  matrix: {
    defaultInput: '1, 2, 3, 4, 5, 6, 7, 8, 9',
    inputHint: '输入 9 个数字，按 3 行 3 列展示。',
    description: '矩阵用行和列组织数据，适合表达表格、关系和数值计算。',
    learn: '观察行、列、单元格和转置关系。',
    complexity: '访问单元格通常 O(1)，整体变换取决于矩阵规模。',
  },
};

interface StructureSpec {
  key: string;
  name: string;
  englishName?: string;
  group: string;
  visualFamily?: VisualFamily;
  note?: string;
  defaultInput?: string;
}

const STRUCTURE_NOTES: Record<string, string> = {
  'static-array': '容量在创建时确定，插入时不能自动扩容。',
  'dynamic-array': '连续存储元素，容量不足时申请更大的连续空间并搬移元素。',
  vector: '动态数组的常用实现，支持按下标访问并在尾部高效追加。',
  slice: '数组的一段视图，通常共享底层存储而不复制全部元素。',
  'segmented-array': '把一个逻辑序列拆成多个小段，减少整体搬移。',
  'chunked-array': '每个块保存一小段连续元素，块之间再按顺序连接。',
  'sentinel-linked-list': '用哨兵节点统一处理头尾边界，减少特殊分支。',
  'intrusive-linked-list': '链表指针直接放在业务对象内部，不额外包装节点。',
  'unrolled-linked-list': '每个节点保存多个元素，在链表指针和数组访问之间折中。',
  'skip-list': '在链表上增加多层索引，用随机高度加速查找。',
  'monotonic-stack': '入栈时移除破坏顺序的元素，栈内保持单调。',
  'monotonic-queue': '从队尾清理不可能成为答案的元素，保留单调候选队列。',
  'ring-buffer': '固定容量的首尾相接缓冲区，读写指针到末尾后回绕。',
  'direct-address-table': '键的范围较小时，直接把键当作数组下标。',
  'robin-hood-hash': '让探测距离短的键与长距离键交换，尽量均衡冲突。',
  'hopscotch-hash': '把键限制在哈希桶附近的邻域内，便于缓存友好访问。',
  'extendible-hash': '根据局部深度分裂桶，目录可以逐步扩展。',
  'linear-hash': '不一次性扩容整张表，而是按顺序逐桶分裂。',
  'perfect-hash': '针对静态键集合构造无冲突映射。',
  'consistent-hash': '节点变化时只重新分配环上邻近的一小段键。',
  'ordered-set': '集合按顺序保存元素，便于范围查询和有序遍历。',
  multiset: '允许同一个值出现多次，并记录出现次数。',
  multimap: '一个键可以对应多个值。',
  'bloom-filter': '多个位共同表示“可能存在”，出现 0 位时可以确定不存在。',
  'cuckoo-filter': '保存短指纹并提供两个候选桶，支持近似成员查询。',
  'count-min-sketch': '用多行计数器估计频率，结果不会低估真实频率。',
  hyperloglog: '用多个寄存器估计集合中不同元素的数量。',
  'order-statistic-tree': '在搜索树节点上维护子树规模，可查询第 k 小元素。',
  'cartesian-tree': '同时满足原序列顺序和堆序，常用于区间最小值问题。',
  'red-black': '通过颜色和旋转限制树高，红色节点不能与红色父节点相邻。',
  splay: '每次访问后把节点旋转到根，频繁访问的节点会变近。',
  treap: '节点按键满足搜索树顺序，同时按随机优先级满足堆序。',
  'segment-tree': '把一个范围递归拆分成子范围，支持区间查询和更新。',
  'fenwick-tree': '用二进制低位表示前缀范围，快速维护前缀和。',
  'wavelet-tree': '按值域递归划分序列，支持第 k 小和秩查询。',
  'b-tree': '一个节点保存多个键和多个孩子，适合减少外存访问次数。',
  'b-plus-tree': '内部节点只导航，数据集中在叶子层，叶子通常顺序相连。',
  'two-three-tree': '每个节点保存 1 或 2 个键，并保持所有叶子同高。',
  'two-three-four-tree': '每个节点保存 1 到 3 个键，通过分裂保持平衡。',
  'suffix-array': '把所有后缀按字典序排列，用数组保存它们的起始位置。',
  'lcp-array': '记录相邻后缀的最长公共前缀长度。',
  'fm-index': '基于 BWT 的压缩索引，可以在压缩文本上反向匹配。',
  'inverted-index': '把词映射到出现它的文档或位置列表。',
  'sparse-matrix': '只保存非零元素，适合大规模且大部分位置为空的矩阵。',
  'csr-matrix': '按行压缩保存非零值、列下标和行起始位置。',
  'csc-matrix': '按列压缩保存非零值、行下标和列起始位置。',
  'tridiagonal-matrix': '只有主对角线及其相邻两条对角线可能非零。',
};

const specs = (value: string): StructureSpec[] => value.split('|').map((item) => {
  const [key, name, englishName] = item.split(':');
  return { key, name, englishName, group: '' };
});

function createDefinitions(category: LabCategory, iconKey: string, family: VisualFamily, list: StructureSpec[], overrides: Partial<StructureSpec> = {}): StructureDefinition[] {
  return list.map((item) => {
    const visualFamily = item.visualFamily ?? family;
    const info = FAMILY_DEFAULTS[visualFamily];
    const note = item.note ?? STRUCTURE_NOTES[item.key] ?? info.description;
    return {
      key: item.key,
      name: item.name,
      englishName: item.englishName ?? item.name,
      category,
      group: item.group || overrides.group || '基础结构',
      visualFamily,
      iconKey,
      description: note,
      beginnerNote: note,
      learn: info.learn,
      complexity: info.complexity,
      defaultInput: item.defaultInput ?? info.defaultInput,
      inputHint: info.inputHint,
      operations: operationsFor(item.key, visualFamily),
      maxItems: visualFamily === 'matrix' ? 9 : visualFamily === 'graph' ? 8 : 12,
    };
  });
}

const linearDefinitions = createDefinitions('linear', 'linear', 'sequence', [
  ...specs('array:数组:Array|static-array:静态数组:Static Array|dynamic-array:动态数组:Dynamic Array|vector:向量:Vector|slice:切片:Slice|segmented-array:分段数组:Segmented Array|chunked-array:分块数组:Chunked Array|multidimensional-array:多维数组:Multidimensional Array|sparse-array:稀疏数组:Sparse Array|char-array:字符数组:Character Array'),
  ...specs('singly-linked-list:单链表:Singly Linked List|doubly-linked-list:双链表:Doubly Linked List|circular-singly-linked-list:循环单链表:Circular Singly Linked List|circular-doubly-linked-list:循环双链表:Circular Doubly Linked List|static-linked-list:静态链表:Static Linked List|sentinel-linked-list:带哨兵链表:Sentinel Linked List|intrusive-linked-list:侵入式链表:Intrusive Linked List|xor-linked-list:异或链表:XOR Linked List|unrolled-linked-list:分块链表:Unrolled Linked List|catenable-list:可连接链表:Catenable List|skip-list:跳表:Skip List').map((item) => ({ ...item, visualFamily: 'linked' as VisualFamily, group: '链式结构' })),
  ...specs('stack:栈:Stack|two-stack:两栈共享空间:Two Stacks|min-stack:最小栈:Min Stack|max-stack:最大栈:Max Stack|monotonic-stack:单调栈:Monotonic Stack').map((item) => ({ ...item, visualFamily: 'stack' as VisualFamily, group: '受限线性结构' })),
  ...specs('queue:队列:Queue|circular-queue:循环队列:Circular Queue|deque:双端队列:Deque|blocking-queue:阻塞队列:Blocking Queue|monotonic-queue:单调队列:Monotonic Queue|ring-buffer:环形缓冲区:Ring Buffer').map((item) => ({ ...item, visualFamily: item.key === 'monotonic-queue' || item.key === 'ring-buffer' ? 'queue' as VisualFamily : 'queue' as VisualFamily, group: '队列结构' })),
  ...specs('priority-queue:优先队列:Priority Queue').map((item) => ({ ...item, visualFamily: 'heap' as VisualFamily, group: '优先结构' })),
]);

const hashDefinitions = createDefinitions('hash', 'hash', 'hash', [
  ...specs('hash-table:哈希表:Hash Table|hash-set:哈希集合:Hash Set|hash-map:哈希映射:Hash Map|direct-address-table:直接寻址表:Direct Address Table|chained-hash:链地址法哈希:Chaining|open-addressing-hash:开放寻址哈希:Open Addressing|linear-probing-hash:线性探测:Linear Probing|quadratic-probing-hash:二次探测:Quadratic Probing|double-hash:双重哈希:Double Hashing|robin-hood-hash:Robin Hood 哈希:Robin Hood Hashing|hopscotch-hash:Hopscotch 哈希:Hopscotch Hashing|cuckoo-hash:布谷鸟哈希:Cuckoo Hashing|extendible-hash:可扩展哈希:Extendible Hashing|linear-hash:线性哈希:Linear Hashing|perfect-hash:完美哈希:Perfect Hashing|consistent-hash:一致性哈希:Consistent Hashing').map((item) => ({ ...item, group: '哈希与集合' })),
  ...specs('ordered-set:有序集合:Ordered Set|ordered-map:有序映射:Ordered Map|multiset:多重集合:Multiset|multimap:多重映射:Multimap|sparse-set:稀疏集合:Sparse Set').map((item) => ({ ...item, group: '集合与映射' })),
  ...specs('bitmap:位图:Bitmap|bitset:位集合:Bitset|bit-vector:位向量:Bit Vector').map((item) => ({ ...item, visualFamily: 'bits' as VisualFamily, group: '位结构' })),
  ...specs('bloom-filter:布隆过滤器:Bloom Filter|counting-bloom:计数布隆过滤器:Counting Bloom Filter|stable-bloom:稳定布隆过滤器:Stable Bloom Filter|scalable-bloom:可扩展布隆过滤器:Scalable Bloom Filter|cuckoo-filter:布谷鸟过滤器:Cuckoo Filter|quotient-filter:商过滤器:Quotient Filter|xor-filter:XOR 过滤器:XOR Filter').map((item) => ({ ...item, visualFamily: 'filter' as VisualFamily, group: '概率结构' })),
  ...specs('count-min-sketch:Count-Min Sketch:Count-Min Sketch|count-sketch:Count Sketch:Count Sketch|hyperloglog:HyperLogLog:HyperLogLog|kll-sketch:KLL 分位数草图:KLL Sketch').map((item) => ({ ...item, visualFamily: 'sketch' as VisualFamily, group: '概率统计' })),
]);

const treeDefinitions = createDefinitions('tree', 'tree', 'tree', [
  ...specs('general-tree:普通树:General Tree|multiway-tree:多叉树:Multiway Tree|binary-tree:二叉树:Binary Tree|full-binary-tree:满二叉树:Full Binary Tree|complete-binary-tree:完全二叉树:Complete Binary Tree|perfect-binary-tree:完美二叉树:Perfect Binary Tree|threaded-binary-tree:线索二叉树:Threaded Binary Tree').map((item) => ({ ...item, group: '基础树' })),
  ...specs('bst:二叉搜索树:Binary Search Tree|avl:AVL 树:AVL Tree|red-black:红黑树:Red-Black Tree|splay:伸展树:Splay Tree|treap:Treap 树:Treap|scapegoat:替罪羊树:Scapegoat Tree|weight-balanced-tree:权重平衡树:Weight-Balanced Tree|aa-tree:AA 树:AA Tree|randomized-bst:随机化搜索树:Randomized BST|tango-tree:Tango Tree:Tango Tree|cartesian-tree:笛卡尔树:Cartesian Tree|order-statistic-tree:顺序统计树:Order Statistic Tree').map((item) => ({ ...item, group: '搜索与平衡树' })),
  ...specs('expression-tree:表达式树:Expression Tree|decision-tree:决策树:Decision Tree|huffman-tree:哈夫曼树:Huffman Tree|merkle-tree:Merkle Tree').map((item) => ({ ...item, group: '应用树' })),
  ...specs('binary-heap:二叉堆:Binary Heap|d-ary-heap:d 叉堆:d-ary Heap|pairing-heap:配对堆:Pairing Heap|leftist-heap:左偏树:Leftist Heap|skew-heap:斜堆:Skew Heap|fibonacci-heap:斐波那契堆:Fibonacci Heap|binomial-heap:二项堆:Binomial Heap|weak-heap:弱堆:Weak Heap|soft-heap:软堆:Soft Heap|interval-heap:区间堆:Interval Heap|min-max-heap:最小-最大堆:Min-Max Heap|tournament-tree:锦标赛树:Tournament Tree|radix-heap:基数堆:Radix Heap|indexed-heap:索引堆:Indexed Heap').map((item) => ({ ...item, visualFamily: 'heap' as VisualFamily, group: '堆' })),
  ...specs('trie:字典树 Trie:Trie|compressed-trie:压缩字典树:Compressed Trie|radix-tree:Radix Tree:Radix Tree|patricia-tree:Patricia Tree:Patricia Tree|ternary-search-tree:三分搜索树:Ternary Search Tree|crit-bit-tree:Crit-bit Tree:Crit-bit Tree|burst-trie:Burst Trie:Burst Trie|double-array-trie:双数组字典树:Double-Array Trie|dawg:有向无环词图:DAWG').map((item) => ({ ...item, visualFamily: 'trie' as VisualFamily, group: '前缀树' })),
  ...specs('segment-tree:线段树:Segment Tree|lazy-segment-tree:懒标记线段树:Lazy Segment Tree|dynamic-segment-tree:动态线段树:Dynamic Segment Tree|interval-tree:区间树:Interval Tree|fenwick-tree:树状数组:Fenwick Tree|merge-sort-tree:归并排序树:Merge Sort Tree|wavelet-tree:波列树:Wavelet Tree|range-tree:范围树:Range Tree|van-emde-boas:Van Emde Boas 树:Van Emde Boas Tree').map((item) => ({ ...item, group: '区间结构' })),
  ...specs('b-tree:B 树:B-Tree|b-plus-tree:B+ 树:B+ Tree|b-star-tree:B* 树:B* Tree|b-link-tree:B-link 树:B-link Tree|t-tree:T 树:T-Tree|fractal-tree:Fractal Tree:Fractal Tree|two-three-tree:2-3 树:2-3 Tree|two-three-four-tree:2-3-4 树:2-3-4 Tree').map((item) => ({ ...item, group: '多路平衡树' })),
  ...specs('rope:Rope 字符串树:Rope').map((item) => ({ ...item, visualFamily: 'text' as VisualFamily, group: '文本树' })),
]);

const graphDefinitions = createDefinitions('graph', 'graph', 'graph', [
  ...specs('undirected-graph:无向图:Undirected Graph|directed-graph:有向图:Directed Graph|weighted-graph:加权图:Weighted Graph|unweighted-graph:无权图:Unweighted Graph|connected-graph:连通图:Connected Graph|bipartite-graph:二分图:Bipartite Graph|complete-graph:完全图:Complete Graph|sparse-graph:稀疏图:Sparse Graph|dense-graph:稠密图:Dense Graph|multigraph:多重图:Multigraph|hypergraph:超图:Hypergraph|planar-graph:平面图:Planar Graph|flow-network:流网络:Flow Network|dag:DAG 有向无环图:DAG|temporal-graph:时态图:Temporal Graph|dynamic-graph:动态图:Dynamic Graph').map((item) => ({ ...item, group: '图模型' })),
  ...specs('adjacency-matrix:邻接矩阵:Adjacency Matrix|incidence-matrix:关联矩阵:Incidence Matrix').map((item) => ({ ...item, group: '图的存储表示' })),
  ...specs('adjacency-list:邻接表:Adjacency List|edge-list:边集数组:Edge List|cross-linked-list:十字链表:Cross Linked List|adjacency-multilist:邻接多重表:Adjacency Multilist|inverse-adjacency-list:逆邻接表:Inverse Adjacency List|forward-star:链式前向星:Forward Star|csr-graph:CSR 图:CSR Graph|csc-graph:CSC 图:CSC Graph|coo-graph:COO 图:COO Graph|dok-graph:DOK 图:DOK Graph|lil-graph:LIL 图:LIL Graph|ell-graph:ELL 图:ELL Graph|bsr-graph:BSR 图:BSR Graph').map((item) => ({ ...item, group: '图的存储表示' })),
  ...specs('disjoint-set:并查集:Disjoint Set|rollback-disjoint-set:可撤销并查集:Rollback DSU|link-cut-tree:Link-Cut Tree:Link-Cut Tree|euler-tour-tree:Euler Tour Tree:Euler Tour Tree|spanning-tree:生成树:Spanning Tree|minimum-spanning-tree:最小生成树:Minimum Spanning Tree').map((item) => ({ ...item, visualFamily: item.key.includes('disjoint') ? 'dsu' as VisualFamily : 'graph' as VisualFamily, group: '连通性与生成树' })),
]);

const stringDefinitions = createDefinitions('string', 'text', 'text', [
  ...specs('string:字符串:String|string-array:字符串数组:String Array|mutable-string:可变字符串:Mutable String|string-buffer:字符串缓冲区:String Buffer|string-builder:字符串构建器:String Builder|gap-buffer:间隙缓冲区:Gap Buffer|piece-table:分块表:Piece Table').map((item) => ({ ...item, group: '基础文本结构' })),
  ...specs('suffix-trie:后缀 Trie:Suffix Trie|suffix-tree:后缀树:Suffix Tree|suffix-array:后缀数组:Suffix Array|lcp-array:LCP 数组:LCP Array|compressed-suffix-array:压缩后缀数组:Compressed Suffix Array|suffix-automaton:后缀自动机:Suffix Automaton|palindrome-tree:回文树:Palindromic Tree|aho-corasick:Aho-Corasick 自动机:Aho-Corasick|dawg-string:有向无环词图:DAWG').map((item) => ({ ...item, group: '模式与后缀结构' })),
  ...specs('fm-index:FM-Index:FM-Index|bwt-index:BWT 索引:BWT Index|kmp-table:KMP 失败函数表:KMP Failure Table|z-array:Z 函数数组:Z Array|dfa:确定有限自动机:DFA|nfa:非确定有限自动机:NFA|epsilon-nfa:ε-NFA:Epsilon-NFA').map((item) => ({ ...item, group: '文本索引与自动机' })),
  ...specs('inverted-index:倒排索引:Inverted Index|ngram-index:n-gram 索引:n-gram Index').map((item) => ({ ...item, group: '文本索引' })),
]);

const matrixDefinitions = createDefinitions('matrix', 'matrix', 'matrix', [
  ...specs('matrix:普通矩阵:Matrix|dense-matrix:稠密矩阵:Dense Matrix|sparse-matrix:稀疏矩阵:Sparse Matrix|coo-matrix:COO 矩阵:COO Matrix|csr-matrix:CSR 矩阵:CSR Matrix|csc-matrix:CSC 矩阵:CSC Matrix|dia-matrix:DIA 矩阵:DIA Matrix|ell-matrix:ELL 矩阵:ELL Matrix|dok-matrix:DOK 矩阵:DOK Matrix|lil-matrix:LIL 矩阵:LIL Matrix|bsr-matrix:BSR 矩阵:BSR Matrix|diagonal-matrix:对角矩阵:Diagonal Matrix|banded-matrix:带状矩阵:Banded Matrix|tridiagonal-matrix:三对角矩阵:Tridiagonal Matrix|upper-triangular-matrix:上三角矩阵:Upper Triangular Matrix|lower-triangular-matrix:下三角矩阵:Lower Triangular Matrix|symmetric-matrix:对称矩阵:Symmetric Matrix|toeplitz-matrix:Toeplitz 矩阵:Toeplitz Matrix|circulant-matrix:循环矩阵:Circulant Matrix|block-matrix:块矩阵:Block Matrix|tensor:张量:Tensor|bit-matrix:位矩阵:Bit Matrix|tree-matrix:树状矩阵:Tree Matrix'),
]);

export const LAB_CATEGORIES: Array<{ key: LabCategory; label: string; description: string }> = [
  { key: 'linear', label: '线性结构', description: '顺序、链式、栈和队列' },
  { key: 'hash', label: '哈希与集合', description: '映射、位图和概率结构' },
  { key: 'tree', label: '树形结构', description: '搜索树、堆、Trie 和索引树' },
  { key: 'graph', label: '图结构', description: '顶点、边、遍历和连通性' },
  { key: 'string', label: '字符串结构', description: '文本、后缀和模式索引' },
  { key: 'matrix', label: '矩阵结构', description: '行列、稀疏存储和张量' },
];

export const STRUCTURE_CATALOG: StructureDefinition[] = [
  ...linearDefinitions,
  ...hashDefinitions,
  ...treeDefinitions,
  ...graphDefinitions,
  ...stringDefinitions,
  ...matrixDefinitions,
];

export const DEFAULT_STRUCTURE_KEY = 'array';

export function getStructureDefinition(key: string) {
  return STRUCTURE_CATALOG.find((item) => item.key === key) ?? STRUCTURE_CATALOG[0];
}
