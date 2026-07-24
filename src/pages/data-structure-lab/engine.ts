import type {
  FrameStatus,
  GraphEdge,
  HashBucket,
  LabFrame,
  LabModel,
  OperationDefinition,
  StructureDefinition,
  TreeNode,
  TrieNode,
} from './types';

export const MAX_VISUAL_ITEMS = 12;
export const MAX_HISTORY_FRAMES = 160;

const BALANCED_TREE_KEYS = ['avl', 'red-black', 'splay', 'treap', 'scapegoat', 'weight-balanced-tree', 'aa-tree', 'randomized-bst', 'tango-tree'];
const MULTIWAY_TREE_KEYS = ['b-tree', 'b-plus-tree', 'b-star-tree', 'b-link-tree', 't-tree', 'fractal-tree', 'two-three-tree', 'two-three-four-tree'];
const RANGE_TREE_KEYS = ['segment-tree', 'lazy-segment-tree', 'dynamic-segment-tree', 'interval-tree', 'fenwick-tree', 'merge-sort-tree', 'wavelet-tree', 'range-tree', 'van-emde-boas'];

function isBalancedTree(definition: StructureDefinition) {
  return BALANCED_TREE_KEYS.includes(definition.key);
}

function isMultiwayTree(definition: StructureDefinition) {
  return MULTIWAY_TREE_KEYS.includes(definition.key);
}

function isSearchTree(definition: StructureDefinition) {
  return definition.key === 'bst' || isBalancedTree(definition) || definition.key === 'cartesian-tree' || definition.key === 'order-statistic-tree';
}

function cloneModel(model: LabModel): LabModel {
  return {
    values: [...model.values],
    text: model.text,
    capacity: model.capacity,
    headIndex: model.headIndex,
    tailIndex: model.tailIndex,
    buckets: model.buckets.map((bucket) => ({ index: bucket.index, entries: [...bucket.entries] })),
    counters: [...model.counters],
    bits: [...model.bits],
    nodes: model.nodes.map((node) => ({ ...node })),
    trieNodes: model.trieNodes.map((node) => ({ ...node, children: [...node.children] })),
    vertices: [...model.vertices],
    edges: model.edges.map((edge) => ({ ...edge })),
    visited: [...model.visited],
    matrix: model.matrix.map((row) => [...row]),
    parents: [...model.parents],
    ranks: [...model.ranks],
    rows: [...model.rows],
  };
}

function blankModel(): LabModel {
  return {
    values: [],
    text: '',
    capacity: MAX_VISUAL_ITEMS,
    headIndex: 0,
    tailIndex: 0,
    buckets: createBuckets(8),
    counters: Array(8).fill(0),
    bits: Array(16).fill(0),
    nodes: [],
    trieNodes: [],
    vertices: [],
    edges: [],
    visited: [],
    matrix: [],
    parents: [],
    ranks: [],
    rows: [],
  };
}

function createBuckets(size: number): HashBucket[] {
  return Array.from({ length: size }, (_, index) => ({ index, entries: [] }));
}

function splitTokens(input: string) {
  return input.split(/[\s,，、;；]+/).map((token) => token.trim()).filter(Boolean);
}

function numericTokens(input: string) {
  return splitTokens(input)
    .map((token) => Number(token))
    .filter((value) => Number.isFinite(value))
    .map(String)
    .slice(0, MAX_VISUAL_ITEMS);
}

function parseNumber(input: string | undefined) {
  const value = Number(input?.trim());
  return Number.isFinite(value) ? value : null;
}

function inputValue(inputs: Record<string, string>, key: string, fallback = '') {
  return inputs[key]?.trim() || fallback;
}

function operationFor(definition: StructureDefinition, key: string): OperationDefinition {
  return definition.operations.find((operation) => operation.key === key) ?? definition.operations[0];
}

function makeFrame(
  model: LabModel,
  operationLabel: string,
  detail: string,
  focusIds: string[] = [],
  status: FrameStatus = 'success',
): LabFrame {
  return { model: cloneModel(model), operationLabel, detail, focusIds, status };
}

function hashCode(value: string) {
  return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function hashIndex(value: string, size: number, offset = 0) {
  return (hashCode(value) + offset * 3) % size;
}

function makeTreeNode(id: string, label: string, parentId: string | null, depth: number, extra: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    label,
    keys: [label],
    parentId,
    depth,
    leftId: null,
    rightId: null,
    childrenIds: [],
    ...extra,
  };
}

function treeKeys(node: TreeNode) {
  return node.keys ?? [node.label];
}

function setTreeKeys(node: TreeNode, keys: string[]) {
  node.keys = keys;
  node.label = keys.join(' · ');
  node.size = keys.length;
}

function recalculateTreeMetadata(nodes: TreeNode[]) {
  const root = nodes.find((node) => node.parentId === null);
  if (!root) return;
  const visit = (node: TreeNode, parentId: string | null, depth: number): number => {
    node.parentId = parentId;
    node.depth = depth;
    const childIds = node.childrenIds && node.childrenIds.length > 0
      ? node.childrenIds
      : [node.leftId, node.rightId].filter((id): id is string => Boolean(id));
    let size = treeKeys(node).length;
    childIds.forEach((childId) => {
      const child = nodes.find((item) => item.id === childId);
      if (child) size += visit(child, node.id, depth + 1);
    });
    node.size = size;
    return size;
  };
  visit(root, null, 0);
}

function buildBalancedTree(values: string[]): TreeNode[] {
  const result: TreeNode[] = [];
  const ordered = [...values].sort(compareLabels);

  const visit = (items: string[], parentId: string | null, depth: number) => {
    if (items.length === 0) return null;
    const middle = Math.floor(items.length / 2);
    const id = `tree-${result.length}`;
    result.push(makeTreeNode(id, items[middle], parentId, depth));
    const leftId = visit(items.slice(0, middle), id, depth + 1);
    const rightId = visit(items.slice(middle + 1), id, depth + 1);
    const current = result.find((node) => node.id === id);
    if (current) {
      current.leftId = leftId;
      current.rightId = rightId;
    }
    return id;
  };

  visit(ordered, null, 0);
  recalculateTreeMetadata(result);
  return result;
}

function buildSearchTree(values: string[]): TreeNode[] {
  const result: TreeNode[] = [];
  values.forEach((value) => insertTreeValue(result, value));
  recalculateTreeMetadata(result);
  return result;
}

function insertTreeValue(nodes: TreeNode[], value: string) {
  const id = `tree-${nextNumericId(nodes, 'tree-')}`;
  if (nodes.length === 0) {
    nodes.push(makeTreeNode(id, value, null, 0));
    return id;
  }

  let current = nodes.find((node) => node.parentId === null);
  while (current) {
    const direction = compareLabels(value, current.label) < 0 ? 'leftId' : 'rightId';
    const childId = current[direction];
    if (!childId) {
      nodes.push(makeTreeNode(id, value, current.id, current.depth + 1));
      current[direction] = id;
      return id;
    }
    const child = nodes.find((node) => node.id === childId);
    if (!child) return id;
    current = child;
  }
  return id;
}

function buildNaryTree(values: string[], arity: number): TreeNode[] {
  const safeValues = values.length > 0 ? values : ['root'];
  const nodes = safeValues.map((value, index) => makeTreeNode(`tree-${index}`, value, null, 0));
  nodes.forEach((node, index) => {
    const firstChild = index * arity + 1;
    const children = safeValues.slice(firstChild, firstChild + arity).map((_, offset) => `tree-${firstChild + offset}`);
    node.childrenIds = children;
    children.forEach((childId) => {
      const child = nodes.find((item) => item.id === childId);
      if (child) child.parentId = node.id;
    });
  });
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildMultiwayTree(values: string[], maxKeys: number): TreeNode[] {
  const ordered = Array.from(new Set(values)).sort(compareLabels);
  if (ordered.length === 0) return [];
  const nodes: TreeNode[] = [];
  const build = (items: string[], parentId: string | null, depth: number): string => {
    const id = `tree-${nodes.length}`;
    const node = makeTreeNode(id, items.join(' · '), parentId, depth);
    nodes.push(node);
    if (items.length <= maxKeys + 1) {
      setTreeKeys(node, items);
      return id;
    }
    const groupSize = maxKeys + 1;
    const groups: string[][] = [];
    for (let index = 0; index < items.length; index += groupSize) groups.push(items.slice(index, index + groupSize));
    const children = groups.map((group) => build(group, id, depth + 1));
    node.childrenIds = children;
    setTreeKeys(node, groups.slice(1).map((group) => group[0]));
    return id;
  };
  build(ordered, null, 0);
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildCartesianTree(values: string[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  const build = (items: string[], parentId: string | null, depth: number): string | null => {
    if (items.length === 0) return null;
    let minimumIndex = 0;
    items.forEach((item, index) => {
      if (compareLabels(item, items[minimumIndex]) < 0) minimumIndex = index;
    });
    const id = `tree-${nodes.length}`;
    const node = makeTreeNode(id, items[minimumIndex], parentId, depth);
    nodes.push(node);
    node.leftId = build(items.slice(0, minimumIndex), id, depth + 1);
    node.rightId = build(items.slice(minimumIndex + 1), id, depth + 1);
    return id;
  };
  build(values, null, 0);
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildRangeTree(values: string[]): TreeNode[] {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (numbers.length === 0) return [];
  const nodes: TreeNode[] = [];
  const build = (left: number, right: number, parentId: string | null, depth: number): string => {
    const id = `tree-${nodes.length}`;
    const total = numbers.slice(left, right + 1).reduce((sum, value) => sum + value, 0);
    const node = makeTreeNode(id, `[${left}, ${right}]`, parentId, depth, { priority: total });
    node.keys = left === right ? [String(numbers[left])] : [];
    nodes.push(node);
    if (left < right) {
      const middle = Math.floor((left + right) / 2);
      node.leftId = build(left, middle, id, depth + 1);
      node.rightId = build(middle + 1, right, id, depth + 1);
    }
    return id;
  };
  build(0, numbers.length - 1, null, 0);
  recalculateTreeMetadata(nodes);
  return nodes;
}

function treapPriority(value: string, index: number) {
  return (hashCode(`${value}:${index}`) % 97) + 1;
}

function buildTreapTree(values: string[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  values.forEach((value, index) => {
    const id = insertTreeValue(nodes, value);
    const node = nodeById(nodes, id);
    if (node) node.priority = treapPriority(value, index);
    let current = node;
    while (current?.parentId) {
      const parent = nodeById(nodes, current.parentId);
      if (!parent || (current.priority ?? 0) >= (parent.priority ?? 0)) break;
      const promoted = parent.leftId === current.id ? rotateRight(nodes, parent.id) : rotateLeft(nodes, parent.id);
      current = nodeById(nodes, promoted);
    }
  });
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildHuffmanTree(values: string[]): TreeNode[] {
  const weights = values.map(Number).filter(Number.isFinite).slice(0, MAX_VISUAL_ITEMS);
  if (weights.length === 0) return [];
  const nodes: TreeNode[] = [];
  const queue = weights.map((weight, index) => {
    const node = makeTreeNode(`tree-${nodes.length}`, String(weight), null, 0, { priority: weight });
    nodes.push(node);
    return { id: node.id, weight };
  });
  while (queue.length > 1) {
    queue.sort((left, right) => left.weight - right.weight);
    const left = queue.shift()!;
    const right = queue.shift()!;
    const parent = makeTreeNode(`tree-${nodes.length}`, String(left.weight + right.weight), null, 0, { priority: left.weight + right.weight });
    parent.leftId = left.id;
    parent.rightId = right.id;
    nodes.push(parent);
    queue.push({ id: parent.id, weight: left.weight + right.weight });
  }
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildMerkleTree(values: string[]): TreeNode[] {
  const source = values.length > 0 ? values : ['A', 'B', 'C', 'D'];
  const nodes: TreeNode[] = source.map((value, index) => makeTreeNode(`tree-${index}`, `H(${value})`, null, 0));
  let level = nodes.map((node) => node.id);
  while (level.length > 1) {
    const next: string[] = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      const parent = makeTreeNode(`tree-${nodes.length}`, `H(${left}|${right})`, null, 0);
      parent.leftId = left;
      parent.rightId = right === left ? null : right;
      nodes.push(parent);
      next.push(parent.id);
    }
    level = next;
  }
  recalculateTreeMetadata(nodes);
  return nodes;
}

function buildTreeForDefinition(definition: StructureDefinition, values: string[]): TreeNode[] {
  if (isMultiwayTree(definition)) {
    const maxKeys = definition.key === 'two-three-tree' ? 2 : definition.key === 'two-three-four-tree' ? 3 : definition.key === 'b-star-tree' ? 4 : 3;
    return buildMultiwayTree(values, maxKeys);
  }
  if (definition.key === 'general-tree') return buildNaryTree(values, 3);
  if (definition.key === 'multiway-tree') return buildNaryTree(values, 4);
  if (['binary-tree', 'full-binary-tree', 'complete-binary-tree', 'perfect-binary-tree', 'threaded-binary-tree'].includes(definition.key)) return buildNaryTree(values, 2);
  if (definition.key === 'expression-tree') return buildNaryTree(values, 2);
  if (definition.key === 'decision-tree') return buildNaryTree(values, 2);
  if (definition.key === 'huffman-tree') return buildHuffmanTree(values);
  if (definition.key === 'merkle-tree') return buildMerkleTree(values);
  if (definition.key === 'cartesian-tree') return buildCartesianTree(values);
  if (RANGE_TREE_KEYS.includes(definition.key)) return buildRangeTree(values);
  if (definition.key === 'treap') return buildTreapTree(values);
  if (definition.key === 'splay') return buildSearchTree(values);
  const nodes = isBalancedTree(definition) ? buildBalancedTree(values) : buildSearchTree(values);
  if (definition.key === 'red-black') nodes.forEach((node) => { node.color = 'black'; });
  if (definition.key === 'order-statistic-tree') recalculateTreeMetadata(nodes);
  return nodes;
}

function collectTreeValues(nodes: TreeNode[], definition?: StructureDefinition) {
  if (definition && (isMultiwayTree(definition) || RANGE_TREE_KEYS.includes(definition.key))) {
    const leaves = nodes.filter((node) => !node.childrenIds || node.childrenIds.length === 0);
    return (leaves.length > 0 ? leaves : nodes).flatMap((node) => treeKeys(node));
  }
  return nodes.flatMap((node) => treeKeys(node));
}

function nextNumericId(nodes: Array<{ id: string }>, prefix: string) {
  const used = nodes
    .map((node) => Number(node.id.replace(prefix, '')))
    .filter((value) => Number.isFinite(value));
  return used.length === 0 ? 0 : Math.max(...used) + 1;
}

function compareLabels(left: string, right: string) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return left.localeCompare(right);
}

function heapArity(definition: StructureDefinition) {
  return definition.key === 'd-ary-heap' ? 3 : 2;
}

function buildHeap(definition: StructureDefinition, values: string[]) {
  const heap = values.map(Number).filter(Number.isFinite);
  const arity = heapArity(definition);
  for (let index = Math.floor(heap.length / arity) - 1; index >= 0; index -= 1) {
    siftDown(heap, index, arity);
  }
  return heap.map(String);
}

function siftDown(values: number[], start: number, arity = 2) {
  let index = start;
  while (true) {
    const firstChild = index * arity + 1;
    let smallest = index;
    for (let offset = 0; offset < arity; offset += 1) {
      const child = firstChild + offset;
      if (child < values.length && values[child] < values[smallest]) smallest = child;
    }
    if (smallest === index) return;
    [values[index], values[smallest]] = [values[smallest], values[index]];
    index = smallest;
  }
}

function buildTrie(words: string[]): TrieNode[] {
  const nodes: TrieNode[] = [{ id: 'trie-root', label: 'root', parentId: null, children: [], depth: 0, terminal: false }];
  words.forEach((word) => insertTrieWord(nodes, word));
  return nodes;
}

function insertTrieWord(nodes: TrieNode[], rawWord: string) {
  const word = rawWord.toUpperCase();
  let parent = nodes[0];
  for (const character of word) {
    let child = nodes.find((node) => node.parentId === parent.id && node.label === character);
    if (!child) {
      child = {
        id: `trie-${nextNumericId(nodes, 'trie-')}`,
        label: character,
        parentId: parent.id,
        children: [],
        depth: parent.depth + 1,
        terminal: false,
      };
      nodes.push(child);
      parent.children.push(child.id);
    }
    parent = child;
  }
  parent.terminal = true;
}

function graphIsDirected(definition: StructureDefinition) {
  return ['directed-graph', 'dag', 'forward-star', 'inverse-adjacency-list'].includes(definition.key);
}

function buildGraph(definition: StructureDefinition, vertices: string[]) {
  const normalized = Array.from(new Set(vertices.map((vertex) => vertex.trim()).filter(Boolean))).slice(0, 8);
  const safeVertices = normalized.length >= 2 ? normalized : ['A', 'B', 'C', 'D', 'E'];
  const edges: GraphEdge[] = [];
  const addEdge = (from: string, to: string, weight: number) => {
    const duplicate = edges.some((edge) => edge.from === from && edge.to === to && definition.key !== 'multigraph');
    if (!duplicate) edges.push({ id: `edge-${edges.length}`, from, to, weight });
  };
  if (definition.key === 'complete-graph') {
    for (let from = 0; from < safeVertices.length; from += 1) {
      for (let to = from + 1; to < safeVertices.length; to += 1) addEdge(safeVertices[from], safeVertices[to], to + 1);
    }
  } else {
    for (let index = 0; index < safeVertices.length - 1; index += 1) addEdge(safeVertices[index], safeVertices[index + 1], index + 1);
    if (safeVertices.length >= 4) addEdge(safeVertices[0], safeVertices[2], 2);
    if (safeVertices.length >= 5) addEdge(safeVertices[1], safeVertices[4], 3);
    if (definition.key === 'multigraph' && safeVertices.length >= 2) addEdge(safeVertices[0], safeVertices[1], 9);
  }
  return { vertices: safeVertices, edges };
}

function graphMatrix(vertices: string[], edges: GraphEdge[], directed: boolean, weighted = false) {
  return vertices.map((from) => vertices.map((to) => {
    const direct = edges.find((edge) => edge.from === from && edge.to === to);
    const reverse = edges.find((edge) => edge.from === to && edge.to === from);
    return direct ? String(weighted ? direct.weight ?? 1 : 1) : !directed && reverse ? String(weighted ? reverse.weight ?? 1 : 1) : '0';
  }));
}

function graphRepresentationMatrix(definition: StructureDefinition, vertices: string[], edges: GraphEdge[]) {
  if (definition.key !== 'incidence-matrix') return graphMatrix(vertices, edges, graphIsDirected(definition));
  const directed = graphIsDirected(definition);
  return vertices.map((vertex) => edges.map((edge) => edge.from === vertex ? 1 : edge.to === vertex ? (directed ? -1 : 1) : 0).map(String));
}

function graphRows(definition: StructureDefinition, vertices: string[], edges: GraphEdge[]) {
  const directed = graphIsDirected(definition);
  if (definition.key === 'adjacency-list' || definition.key === 'inverse-adjacency-list' || definition.key === 'forward-star') {
    return vertices.map((vertex) => {
      const related = directed
        ? edges.filter((edge) => edge.from === vertex).map((edge) => edge.to)
        : edges.flatMap((edge) => edge.from === vertex ? [edge.to] : edge.to === vertex ? [edge.from] : []);
      return `${vertex} → ${related.length > 0 ? related.join(', ') : '∅'}`;
    });
  }
  if (definition.key === 'edge-list' || definition.key === 'spanning-tree' || definition.key === 'minimum-spanning-tree') {
    return edges.map((edge) => `${edge.from} ${directed ? '→' : '—'} ${edge.to}  (w=${edge.weight ?? 1})`);
  }
  if (definition.key === 'cross-linked-list' || definition.key === 'adjacency-multilist') {
    return edges.map((edge) => `${edge.from} ↔ ${edge.to}  [edge ${edge.id}]`);
  }
  if (definition.key === 'csr-graph' || definition.key === 'csc-graph' || definition.key === 'coo-graph' || definition.key === 'dok-graph' || definition.key === 'lil-graph' || definition.key === 'ell-graph' || definition.key === 'bsr-graph') {
    return edges.map((edge, index) => `${index}: (${edge.from}, ${edge.to}) = ${edge.weight ?? 1}`);
  }
  return [];
}

function buildMatrix(definition: StructureDefinition, input: string) {
  const values = numericTokens(input);
  while (values.length < 9) values.push(String(values.length + 1));
  const base = Array.from({ length: 3 }, (_, row) => values.slice(row * 3, row * 3 + 3));
  const sparseKeys = ['sparse-matrix', 'coo-matrix', 'csr-matrix', 'csc-matrix', 'dia-matrix', 'ell-matrix', 'dok-matrix', 'lil-matrix', 'bsr-matrix'];
  return base.map((line, row) => line.map((value, column) => {
    const number = Number(value);
    if (definition.key === 'bit-matrix') return String(Number.isFinite(number) && number % 2 !== 0 ? 1 : 0);
    if (definition.key === 'diagonal-matrix') return row === column ? value : '0';
    if (definition.key === 'tridiagonal-matrix') return Math.abs(row - column) <= 1 ? value : '0';
    if (definition.key === 'banded-matrix') return Math.abs(row - column) <= 1 ? value : '0';
    if (definition.key === 'upper-triangular-matrix') return column >= row ? value : '0';
    if (definition.key === 'lower-triangular-matrix') return column <= row ? value : '0';
    if (definition.key === 'symmetric-matrix') return base[Math.min(row, column)][Math.max(row, column)];
    if (definition.key === 'toeplitz-matrix') return base[0][Math.abs(row - column)];
    if (definition.key === 'circulant-matrix') return base[0][(column - row + 3) % 3];
    if (sparseKeys.includes(definition.key)) return (row + column) % 3 === 0 ? value : '0';
    return value;
  }));
}

function refreshRows(model: LabModel, key: string) {
  const text = model.text;
  if (key === 'suffix-array') {
    model.rows = [...text].map((_, index) => ({ index, suffix: text.slice(index) })).sort((left, right) => left.suffix.localeCompare(right.suffix)).slice(0, 10).map((item) => `${item.index}: ${item.suffix}`);
  } else if (key === 'ngram-index') {
    model.rows = Array.from({ length: Math.max(text.length - 1, 0) }, (_, index) => `${text.slice(index, index + 2)} → ${index}`).slice(0, 12);
  } else if (key === 'inverted-index') {
    const words = text.toUpperCase().split(/\s+/).filter(Boolean);
    model.rows = Array.from(new Set(words)).map((word) => `${word} → ${words.flatMap((item, index) => item === word ? [index] : []).join(', ')}`);
  } else if (['kmp-table', 'z-array'].includes(key)) {
    model.rows = [...text].map((character, index) => `${index}: ${character} / ${key === 'kmp-table' ? 'π' : 'Z'}=${key === 'kmp-table' ? 0 : text.length - index}`).slice(0, 16);
  } else if (['fm-index', 'bwt-index', 'compressed-suffix-array'].includes(key)) {
    const transformed = `${text}$`.split('').reverse().join('');
    model.rows = [`BWT: ${transformed}`, `采样后缀: ${text.slice(0, 12) || '空'}`, '压缩索引：按块保存位置信息'];
  } else {
    model.rows = [...text].map((character, index) => `${index}: ${character}`).slice(0, 16);
  }
}

function refreshMatrixRows(model: LabModel, key: string) {
  const sparse = key.includes('sparse') || ['coo-matrix', 'csr-matrix', 'csc-matrix', 'dia-matrix', 'ell-matrix', 'dok-matrix', 'lil-matrix', 'bsr-matrix'].includes(key);
  model.rows = sparse
    ? model.matrix.flatMap((row, rowIndex) => row.map((value, columnIndex) => value !== '0' ? `(${rowIndex}, ${columnIndex}) → ${value}` : null).filter((value): value is string => Boolean(value))).slice(0, 16)
    : [];
}

function structureCapacity(definition: StructureDefinition, size: number) {
  if (definition.key === 'static-array' || definition.key === 'static-linked-list') return Math.max(8, size);
  if (definition.key === 'circular-queue' || definition.key === 'ring-buffer' || definition.key === 'blocking-queue') return 8;
  return Math.max(MAX_VISUAL_ITEMS, size);
}

function hashMode(definition: StructureDefinition) {
  if (definition.key === 'chained-hash' || definition.key === 'hash-table' || definition.key === 'hash-set' || definition.key === 'hash-map' || definition.key === 'multiset' || definition.key === 'multimap') return 'chain';
  if (definition.key === 'cuckoo-hash') return 'cuckoo';
  if (definition.key === 'direct-address-table') return 'direct';
  return 'probe';
}

function hashBase(definition: StructureDefinition, key: string, size: number) {
  const numericKey = Number(key);
  return hashMode(definition) === 'direct' && Number.isInteger(numericKey) ? Math.abs(numericKey) % size : hashIndex(key, size);
}

function placeHashEntries(definition: StructureDefinition, buckets: HashBucket[], tokens: string[]) {
  const mode = hashMode(definition);
  tokens.slice(0, MAX_VISUAL_ITEMS).forEach((token) => {
    const base = hashBase(definition, token, buckets.length);
    if (mode === 'chain') {
      buckets[base].entries.push(token);
      return;
    }
    if (mode === 'cuckoo') {
      const alternate = hashIndex(token, buckets.length, 1);
      const target = buckets[base].entries.length === 0 ? base : alternate;
      buckets[target].entries.push(token);
      return;
    }
    const target = Array.from({ length: buckets.length }, (_, offset) => (base + offset) % buckets.length).find((index) => buckets[index].entries.length === 0) ?? base;
    buckets[target].entries = [token];
  });
}

export function createInitialFrame(definition: StructureDefinition, input: string): LabFrame {
  const model = blankModel();
  const tokens = splitTokens(input);

  switch (definition.visualFamily) {
    case 'sequence':
    case 'linked':
    case 'stack':
    case 'queue':
      model.values = tokens.slice(0, MAX_VISUAL_ITEMS);
      model.capacity = structureCapacity(definition, model.values.length);
      model.headIndex = 0;
      model.tailIndex = model.values.length % model.capacity;
      break;
    case 'heap':
      model.values = buildHeap(definition, numericTokens(input));
      break;
    case 'tree':
      model.nodes = buildTreeForDefinition(definition, numericTokens(input));
      break;
    case 'trie':
      model.trieNodes = buildTrie(tokens.length > 0 ? tokens : ['DATA', 'TREE', 'TRIE']);
      break;
    case 'hash':
      model.buckets = createBuckets(8);
      placeHashEntries(definition, model.buckets, tokens);
      break;
    case 'bits':
      tokens.map(Number).filter(Number.isInteger).forEach((index) => {
        if (index >= 0 && index < model.bits.length) model.bits[index] = 1;
      });
      break;
    case 'filter':
      tokens.forEach((token) => [hashIndex(token, model.bits.length), hashIndex(token, model.bits.length, 1), hashIndex(token, model.bits.length, 2)].forEach((index) => { model.bits[index] = 1; }));
      break;
    case 'sketch':
      tokens.forEach((token) => {
        const index = hashIndex(token, model.counters.length);
        if (definition.key === 'hyperloglog') {
          const rank = Math.max(1, (hashCode(token) % 6) + 1);
          model.counters[index] = Math.max(model.counters[index], rank);
        } else model.counters[index] += 1;
      });
      break;
    case 'graph': {
      const graph = buildGraph(definition, tokens);
      model.vertices = graph.vertices;
      model.edges = graph.edges;
      model.rows = graphRows(definition, graph.vertices, graph.edges);
      if (['adjacency-matrix', 'incidence-matrix'].includes(definition.key)) model.matrix = graphRepresentationMatrix(definition, graph.vertices, graph.edges);
      break;
    }
    case 'dsu':
      model.parents = tokens.map(Number).filter(Number.isInteger).slice(0, 8);
      if (model.parents.length === 0) model.parents = [0, 1, 2, 3, 4, 5];
      model.ranks = Array(model.parents.length).fill(0);
      break;
    case 'text':
      model.text = input.trim() || definition.defaultInput;
      refreshRows(model, definition.key);
      break;
    case 'matrix':
      model.matrix = buildMatrix(definition, input);
      refreshMatrixRows(model, definition.key);
      break;
    default:
      break;
  }

  return makeFrame(model, '初始状态', `${definition.name}已准备好，可以选择一个操作开始观察。`, [], 'neutral');
}

function sequenceFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const values = [...model.values];
  const result: LabFrame[] = [];
  const label = operation.label;
  const value = inputValue(inputs, 'value', '72');
  const index = parseNumber(inputs.index);

  if (operation.key === 'find') {
    const targetIndex = values.findIndex((item) => item === value);
    values.forEach((item, currentIndex) => {
      result.push(makeFrame(model, `${label} · 检查`, `正在检查第 ${currentIndex} 个元素：${item}。`, [`seq-${currentIndex}`], 'neutral'));
    });
    result.push(makeFrame(model, label, targetIndex >= 0 ? `在下标 ${targetIndex} 找到 ${value}。` : `没有找到 ${value}。`, targetIndex >= 0 ? [`seq-${targetIndex}`] : [], targetIndex >= 0 ? 'success' : 'warning'));
    return result;
  }

  if (operation.key === 'reverse') {
    const next = [...values];
    for (let left = 0, right = next.length - 1; left < right; left += 1, right -= 1) {
      [next[left], next[right]] = [next[right], next[left]];
      result.push(makeFrame({ ...model, values: next }, `${label} · 交换`, `交换下标 ${left} 和 ${right}。`, [`seq-${left}`, `seq-${right}`]));
    }
    result.push(makeFrame({ ...model, values: next }, label, '序列已经完成反转。', []));
    return result;
  }

  if (operation.key === 'insert') {
    const safeIndex = index === null ? values.length : Math.max(0, Math.min(values.length, Math.trunc(index)));
    if (definition.key === 'static-array' && values.length >= model.capacity) return [makeFrame(model, label, `静态数组容量为 ${model.capacity}，没有可用位置。`, [], 'warning')];
    result.push(makeFrame(model, `${label} · 定位`, `准备在下标 ${safeIndex} 处插入 ${value}。`, values.length > 0 ? [`seq-${Math.min(safeIndex, values.length - 1)}`] : [], 'neutral'));
    values.splice(safeIndex, 0, value);
    const nextModel = { ...model, values: values.slice(0, MAX_VISUAL_ITEMS), capacity: definition.key === 'dynamic-array' || definition.key === 'vector' ? Math.max(model.capacity, values.length) : model.capacity };
    result.push(makeFrame(nextModel, label, `已在下标 ${safeIndex} 插入 ${value}。`, [`seq-${Math.min(safeIndex, nextModel.values.length - 1)}`]));
    return result;
  }

  if (operation.key === 'delete') {
    const safeIndex = index === null ? 0 : Math.trunc(index);
    if (safeIndex < 0 || safeIndex >= values.length) return [makeFrame(model, label, `下标 ${safeIndex} 不存在，结构保持不变。`, [], 'warning')];
    const removed = values[safeIndex];
    result.push(makeFrame(model, `${label} · 定位`, `准备删除下标 ${safeIndex} 的元素 ${removed}。`, [`seq-${safeIndex}`], 'neutral'));
    values.splice(safeIndex, 1);
    result.push(makeFrame({ ...model, values, tailIndex: values.length % Math.max(model.capacity, 1) }, label, `已删除 ${removed}，后面的元素向前移动。`, safeIndex < values.length ? [`seq-${safeIndex}`] : []));
    return result;
  }

  if (definition.key === 'static-array' && values.length >= model.capacity) return [makeFrame(model, label, `静态数组容量为 ${model.capacity}，没有可用位置。`, [], 'warning')];
  values.push(value);
  const nextModel = { ...model, values: values.slice(0, MAX_VISUAL_ITEMS), capacity: definition.key === 'dynamic-array' || definition.key === 'vector' ? Math.max(model.capacity, values.length) : model.capacity };
  result.push(makeFrame(nextModel, label, `已把 ${value} 添加到序列末尾。`, [`seq-${nextModel.values.length - 1}`]));
  return result;
}

function linkedFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const values = [...model.values];
  const value = inputValue(inputs, 'value', '64');
  const result: LabFrame[] = [];
  if (operation.key === 'find' || operation.key === 'delete') {
    const targetIndex = values.findIndex((item) => item === value);
    values.forEach((item, index) => result.push(makeFrame(model, `${operation.label} · 遍历`, `沿 next 指针访问节点 ${index}：${item}。`, [`node-${index}`], 'neutral')));
    if (targetIndex < 0) return [...result, makeFrame(model, operation.label, `没有找到节点 ${value}。`, [], 'warning')];
    if (operation.key === 'find') return [...result, makeFrame(model, operation.label, `找到节点 ${value}，它位于链表第 ${targetIndex + 1} 个位置。`, [`node-${targetIndex}`])];
    values.splice(targetIndex, 1);
    return [...result, makeFrame({ ...model, values }, operation.label, `删除节点 ${value}，并把前后节点重新连接。`, targetIndex < values.length ? [`node-${targetIndex}`] : [])];
  }
  if (operation.key === 'reverse') {
    const next = [...values].reverse();
    return [makeFrame(model, `${operation.label} · 翻转`, '正在逐个翻转 next 指针。', values.map((_, index) => `node-${index}`), 'neutral'), makeFrame({ ...model, values: next }, operation.label, '链表方向已经完成翻转。', [])];
  }
  if (operation.key === 'head-insert') {
    values.unshift(value);
    return [makeFrame({ ...model, values }, operation.label, `创建节点 ${value}，让它的 next 指向原来的 head。`, ['node-0'])];
  }
  values.push(value);
  return [makeFrame({ ...model, values }, operation.label, `创建节点 ${value}，把 tail 的 next 指向它。`, [`node-${values.length - 1}`])];
}

function stackFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const values = [...model.values];
  const value = inputValue(inputs, 'value', '64');
  const label = operation.label;
  const result: LabFrame[] = [];
  if (operation.key === 'pop') {
    if (values.length === 0) return [makeFrame(model, label, '栈为空，不能继续出栈。', [], 'warning')];
    const removed = values.pop()!;
    return [makeFrame(model, `${label} · 取出`, `栈顶元素 ${removed} 即将离开。`, [`stack-${values.length}`], 'neutral'), makeFrame({ ...model, values }, label, `已移除栈顶元素 ${removed}。`, values.length > 0 ? [`stack-${values.length - 1}`] : [])];
  }
  if (operation.key === 'peek') {
    return [makeFrame(model, label, values.length > 0 ? `当前栈顶是 ${values[values.length - 1]}。` : '栈为空。', values.length > 0 ? [`stack-${values.length - 1}`] : [], values.length > 0 ? 'success' : 'warning')];
  }
  if (definition.key === 'monotonic-stack') {
    while (values.length > 0 && Number(values[values.length - 1]) > Number(value)) {
      const removed = values.pop()!;
      result.push(makeFrame({ ...model, values }, `${label} · 维护单调性`, `栈顶 ${removed} 大于 ${value}，先移除它。`, [`stack-${values.length}`], 'neutral'));
    }
  }
  values.push(value);
  return [...result, makeFrame({ ...model, values: values.slice(0, MAX_VISUAL_ITEMS) }, label, definition.key === 'monotonic-stack' ? `把 ${value} 放入后，栈仍保持从底到顶递增。` : `把 ${value} 放到栈顶。`, [`stack-${values.length - 1}`])];
}

function queueFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const values = [...model.values];
  const value = inputValue(inputs, 'value', '64');
  const label = operation.label;
  const result: LabFrame[] = [];
  if (operation.key === 'dequeue' || operation.key === 'pop-left' || operation.key === 'pop-right') {
    if (values.length === 0) return [makeFrame(model, label, '队列为空，不能继续出队。', [], 'warning')];
    const fromRight = operation.key === 'pop-right';
    const removed = fromRight ? values.pop()! : values.shift()!;
    const focusId = fromRight ? `queue-${model.values.length - 1}` : 'queue-0';
    return [makeFrame(model, `${label} · 取出`, `${fromRight ? '队尾' : '队首'}元素 ${removed} 即将离开。`, [focusId], 'neutral'), makeFrame({ ...model, values, headIndex: fromRight ? model.headIndex : (model.headIndex + 1) % Math.max(model.capacity, 1) }, label, `已从${fromRight ? '右' : '左'}端移除 ${removed}。`, values.length > 0 ? [fromRight ? `queue-${values.length - 1}` : 'queue-0'] : [])];
  }
  if (operation.key === 'peek') {
    return [makeFrame(model, label, values.length > 0 ? definition.key === 'deque' ? `左端是 ${values[0]}，右端是 ${values[values.length - 1]}。` : `当前队首是 ${values[0]}。` : '队列为空。', values.length > 0 ? definition.key === 'deque' ? ['queue-0', `queue-${values.length - 1}`] : ['queue-0'] : [], values.length > 0 ? 'success' : 'warning')];
  }
  if (definition.key === 'monotonic-queue') {
    while (values.length > 0 && Number(values[values.length - 1]) > Number(value)) {
      const removed = values.pop()!;
      result.push(makeFrame({ ...model, values }, `${label} · 维护单调性`, `队尾 ${removed} 大于 ${value}，先移除它。`, [`queue-${values.length}`], 'neutral'));
    }
  }
  if (operation.key === 'push-left') values.unshift(value);
  else values.push(value);
  const nextValues = values.slice(0, model.capacity);
  const insertedIndex = operation.key === 'push-left' ? 0 : nextValues.length - 1;
  return [...result, makeFrame({ ...model, values: nextValues, tailIndex: operation.key === 'push-left' ? model.tailIndex : (model.tailIndex + 1) % Math.max(model.capacity, 1) }, label, definition.key === 'monotonic-queue' ? `把 ${value} 放到队尾后，队列保持单调。` : `把 ${value} 放到${operation.key === 'push-left' ? '左端' : '右端'}。`, [`queue-${insertedIndex}`])];
}

function hashFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const key = inputValue(inputs, 'key', '42');
  const buckets = model.buckets.map((bucket) => ({ ...bucket, entries: [...bucket.entries] }));
  const mode = hashMode(definition);
  const base = hashBase(definition, key, buckets.length);
  const positions = mode === 'chain' || mode === 'direct'
    ? [base]
    : mode === 'cuckoo'
      ? [base, hashIndex(key, buckets.length, 1)]
      : Array.from({ length: buckets.length }, (_, offset) => (base + offset) % buckets.length);
  const result: LabFrame[] = [];
  if (operation.key === 'find' || operation.key === 'delete') {
    const foundPosition = positions.find((position) => buckets[position].entries.includes(key));
    positions.forEach((position) => result.push(makeFrame(model, `${operation.label} · 探测`, `检查桶 ${position}。`, [`bucket-${position}`], 'neutral')));
    if (foundPosition === undefined) return [...result, makeFrame(model, operation.label, `没有找到键 ${key}。`, [], 'warning')];
    if (operation.key === 'delete') buckets[foundPosition].entries = buckets[foundPosition].entries.filter((entry) => entry !== key);
    return [...result, makeFrame({ ...model, buckets }, operation.label, operation.key === 'delete' ? `已删除键 ${key}。` : `在桶 ${foundPosition} 找到键 ${key}。`, [`bucket-${foundPosition}`])];
  }
  const targetPosition = mode === 'chain'
    ? base
    : positions.find((position) => buckets[position].entries.length === 0);
  result.push(makeFrame(model, `${operation.label} · 计算`, `哈希函数把 ${key} 映射到桶 ${base}。`, [`bucket-${base}`], 'neutral'));
  if (targetPosition === undefined) {
    if (mode === 'cuckoo') return [...result, makeFrame(model, operation.label, `两个候选桶都已占用，需要继续执行驱逐或扩容。`, positions.map((position) => `bucket-${position}`), 'warning')];
    return [...result, makeFrame(model, operation.label, '哈希表已经没有空桶，无法写入新键。', [], 'warning')];
  }
  if (mode === 'direct') buckets[targetPosition].entries = [key];
  else if (!buckets[targetPosition].entries.includes(key)) buckets[targetPosition].entries.push(key);
  const detail = mode === 'chain' && buckets[base].entries.length > 1
    ? `键 ${key} 发生冲突，按链地址法挂到桶 ${targetPosition} 的链上。`
    : mode === 'cuckoo'
      ? `键 ${key} 放入候选桶 ${targetPosition}。`
      : `键 ${key} 已写入桶 ${targetPosition}。`;
  result.push(makeFrame({ ...model, buckets }, operation.label, detail, [`bucket-${targetPosition}`]));
  return result;
}

function bitFrames(model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const index = Math.max(0, Math.min(model.bits.length - 1, Math.trunc(parseNumber(inputs.index) ?? 0)));
  const bits = [...model.bits];
  if (operation.key === 'set-bit') bits[index] = 1;
  if (operation.key === 'clear-bit') bits[index] = 0;
  return [makeFrame(model, `${operation.label} · 定位`, `定位到第 ${index} 位。`, [`bit-${index}`], 'neutral'), makeFrame({ ...model, bits }, operation.label, operation.key === 'query-bit' ? `第 ${index} 位当前是 ${model.bits[index]}。` : `第 ${index} 位现在是 ${bits[index]}。`, [`bit-${index}`], operation.key === 'query-bit' ? 'neutral' : 'success')];
}

function filterFrames(model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const key = inputValue(inputs, 'key', 'apple');
  const positions = [hashIndex(key, model.bits.length), hashIndex(key, model.bits.length, 1), hashIndex(key, model.bits.length, 2)];
  if (operation.key === 'clear') return [makeFrame(model, operation.label, '清除所有哈希位。', [], 'neutral'), makeFrame({ ...model, bits: Array(model.bits.length).fill(0) }, operation.label, '过滤器已经为空。', [])];
  const result = positions.map((position) => makeFrame(model, `${operation.label} · 哈希`, `检查候选位置 ${position}。`, [`bit-${position}`], 'neutral'));
  if (operation.key === 'query') {
    const missing = positions.find((position) => model.bits[position] === 0);
    return [...result, makeFrame(model, operation.label, missing === undefined ? `所有候选位置都为 1，${key} 可能存在。` : `位置 ${missing} 为 0，因此 ${key} 一定不存在。`, positions.map((position) => `bit-${position}`), missing === undefined ? 'neutral' : 'success')];
  }
  const bits = [...model.bits];
  positions.forEach((position) => { bits[position] = 1; });
  return [...result, makeFrame({ ...model, bits }, operation.label, `键 ${key} 已标记 ${positions.length} 个候选位置。`, positions.map((position) => `bit-${position}`))];
}

function sketchFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const key = inputValue(inputs, 'key', 'apple');
  const positions = [hashIndex(key, model.counters.length), hashIndex(key, model.counters.length, 1), hashIndex(key, model.counters.length, 2)];
  const result = positions.map((position) => makeFrame(model, `${operation.label} · 哈希`, `哈希函数访问计数器 ${position}。`, [`counter-${position}`], 'neutral'));
  if (operation.key === 'add') {
    const counters = [...model.counters];
    if (definition.key === 'hyperloglog') counters[positions[0]] = Math.max(counters[positions[0]], (hashCode(key) % 6) + 1);
    else positions.forEach((position) => { counters[position] += 1; });
    return [...result, makeFrame({ ...model, counters }, operation.label, definition.key === 'hyperloglog' ? `样本 ${key} 更新了一个寄存器的最大前导零等级。` : `样本 ${key} 已更新 ${positions.length} 个计数器。`, positions.map((position) => `counter-${position}`))];
  }
  const estimate = Math.min(...positions.map((position) => model.counters[position]));
  return [...result, makeFrame(model, operation.label, definition.key === 'hyperloglog' ? `根据寄存器状态，样本 ${key} 的基数估计正在由多个寄存器共同决定。` : `样本 ${key} 的估计频率为 ${estimate}。`, positions.map((position) => `counter-${position}`), estimate > 0 ? 'success' : 'warning')];
}

function treePath(nodes: TreeNode[], value: string, definition?: StructureDefinition) {
  if (definition && !isSearchTree(definition) && !isMultiwayTree(definition)) {
    const target = nodes.find((node) => node.label === value || treeKeys(node).includes(value));
    if (target) {
      const chain: TreeNode[] = [];
      let currentTarget: TreeNode | undefined = target;
      while (currentTarget) {
        chain.unshift(currentTarget);
        currentTarget = nodeById(nodes, currentTarget.parentId);
      }
      return chain;
    }
  }
  const path: TreeNode[] = [];
  let current = nodes.find((node) => node.parentId === null);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.push(current);
    if (treeKeys(current).some((key) => key === value) || current.label === value) break;
    if (definition && !isSearchTree(definition) && !isMultiwayTree(definition)) {
      const currentId = current.id;
      const next = nodes.find((node) => (node.label === value || treeKeys(node).includes(value)) && node.id !== currentId);
      if (!next) break;
      current = next;
      continue;
    }
    let nextId: string | null | undefined;
    if (current.childrenIds && current.childrenIds.length > 0) {
      const slot = current.keys?.findIndex((key) => compareLabels(value, key) < 0) ?? -1;
      const childIndex = slot < 0 ? current.childrenIds.length - 1 : slot;
      nextId = current.childrenIds[Math.max(0, Math.min(childIndex, current.childrenIds.length - 1))];
    } else nextId = compareLabels(value, current.label) < 0 ? current.leftId : current.rightId;
    current = nextId ? nodes.find((node) => node.id === nextId) : undefined;
  }
  return path;
}

interface TreeStep {
  nodes: TreeNode[];
  label: string;
  detail: string;
  focusIds: string[];
}

function cloneTreeNodes(nodes: TreeNode[]) {
  return nodes.map((node) => ({ ...node, keys: node.keys ? [...node.keys] : undefined, childrenIds: node.childrenIds ? [...node.childrenIds] : undefined }));
}

function nodeById(nodes: TreeNode[], id: string | null | undefined) {
  return id ? nodes.find((node) => node.id === id) : undefined;
}

function treeHeight(nodes: TreeNode[], id: string | null | undefined): number {
  const node = nodeById(nodes, id);
  if (!node) return 0;
  return 1 + Math.max(treeHeight(nodes, node.leftId), treeHeight(nodes, node.rightId));
}

function replaceChildLink(nodes: TreeNode[], parentId: string | null, oldId: string, newId: string) {
  const parent = nodeById(nodes, parentId);
  if (!parent) return;
  if (parent.leftId === oldId) parent.leftId = newId;
  if (parent.rightId === oldId) parent.rightId = newId;
}

function rotateLeft(nodes: TreeNode[], pivotId: string) {
  const pivot = nodeById(nodes, pivotId);
  const promoted = nodeById(nodes, pivot?.rightId);
  if (!pivot || !promoted) return pivotId;
  const parentId = pivot.parentId;
  const middleId = promoted.leftId;
  promoted.parentId = parentId;
  if (parentId === null) replaceChildLink(nodes, null, pivot.id, promoted.id);
  else replaceChildLink(nodes, parentId, pivot.id, promoted.id);
  promoted.leftId = pivot.id;
  pivot.parentId = promoted.id;
  pivot.rightId = middleId;
  if (middleId) {
    const middle = nodeById(nodes, middleId);
    if (middle) middle.parentId = pivot.id;
  }
  recalculateTreeMetadata(nodes);
  return promoted.id;
}

function rotateRight(nodes: TreeNode[], pivotId: string) {
  const pivot = nodeById(nodes, pivotId);
  const promoted = nodeById(nodes, pivot?.leftId);
  if (!pivot || !promoted) return pivotId;
  const parentId = pivot.parentId;
  const middleId = promoted.rightId;
  promoted.parentId = parentId;
  if (parentId === null) replaceChildLink(nodes, null, pivot.id, promoted.id);
  else replaceChildLink(nodes, parentId, pivot.id, promoted.id);
  promoted.rightId = pivot.id;
  pivot.parentId = promoted.id;
  pivot.leftId = middleId;
  if (middleId) {
    const middle = nodeById(nodes, middleId);
    if (middle) middle.parentId = pivot.id;
  }
  recalculateTreeMetadata(nodes);
  return promoted.id;
}

function avlInsert(nodes: TreeNode[], value: string): { nodes: TreeNode[]; steps: TreeStep[] } {
  const nextNodes = cloneTreeNodes(nodes);
  const steps: TreeStep[] = [];
  const insertedId = insertTreeValue(nextNodes, value);
  recalculateTreeMetadata(nextNodes);
  let currentId: string | null | undefined = insertedId;
  while (currentId) {
    const current = nodeById(nextNodes, currentId);
    if (!current) break;
    const balance = treeHeight(nextNodes, current.leftId) - treeHeight(nextNodes, current.rightId);
    if (balance > 1) {
      const left = nodeById(nextNodes, current.leftId);
      if (left && treeHeight(nextNodes, left.leftId) < treeHeight(nextNodes, left.rightId)) {
        const promoted = rotateLeft(nextNodes, left.id);
        steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 左旋', detail: `节点 ${left.label} 先左旋，把较重的右子树提上来。`, focusIds: [left.id, promoted] });
      }
      const promoted = rotateRight(nextNodes, current.id);
      steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 右旋', detail: `节点 ${current.label} 右旋，恢复 AVL 的高度平衡。`, focusIds: [current.id, promoted] });
      currentId = nodeById(nextNodes, promoted)?.parentId;
      continue;
    }
    if (balance < -1) {
      const right = nodeById(nextNodes, current.rightId);
      if (right && treeHeight(nextNodes, right.rightId) < treeHeight(nextNodes, right.leftId)) {
        const promoted = rotateRight(nextNodes, right.id);
        steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 右旋', detail: `节点 ${right.label} 先右旋，处理右子树的内侧失衡。`, focusIds: [right.id, promoted] });
      }
      const promoted = rotateLeft(nextNodes, current.id);
      steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 左旋', detail: `节点 ${current.label} 左旋，恢复 AVL 的高度平衡。`, focusIds: [current.id, promoted] });
      currentId = nodeById(nextNodes, promoted)?.parentId;
      continue;
    }
    currentId = current.parentId;
  }
  recalculateTreeMetadata(nextNodes);
  return { nodes: nextNodes, steps };
}

function redBlackInsert(nodes: TreeNode[], value: string): { nodes: TreeNode[]; steps: TreeStep[] } {
  const nextNodes = cloneTreeNodes(nodes);
  const steps: TreeStep[] = [];
  const insertedId = insertTreeValue(nextNodes, value);
  const inserted = nodeById(nextNodes, insertedId);
  if (inserted) inserted.color = 'red';
  let currentId: string | null | undefined = insertedId;
  while (currentId) {
    const current = nodeById(nextNodes, currentId);
    const parent = nodeById(nextNodes, current?.parentId);
    const grand = nodeById(nextNodes, parent?.parentId);
    if (!current || !parent || parent.color !== 'red' || !grand) break;
    const uncleId = grand.leftId === parent.id ? grand.rightId : grand.leftId;
    const uncle = nodeById(nextNodes, uncleId);
    if (uncle?.color === 'red') {
      parent.color = 'black';
      uncle.color = 'black';
      grand.color = 'red';
      steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 重新着色', detail: `父节点和叔节点都是红色，先把它们染黑，再把冲突向上移动。`, focusIds: [parent.id, uncle.id, grand.id] });
      currentId = grand.id;
      continue;
    }
    if (grand.leftId === parent.id) {
      if (parent.rightId === current.id) {
        const promoted = rotateLeft(nextNodes, parent.id);
        steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 左旋', detail: '先左旋把折线形转换为直线形。', focusIds: [parent.id, current.id, promoted] });
      }
      const newRoot = rotateRight(nextNodes, grand.id);
      const rootNode = nodeById(nextNodes, newRoot);
      const oldGrand = nodeById(nextNodes, grand.id);
      if (rootNode) rootNode.color = 'black';
      if (oldGrand) oldGrand.color = 'red';
      steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 右旋并着色', detail: '右旋并交换颜色，消除连续红节点。', focusIds: [newRoot, grand.id] });
    } else {
      if (parent.leftId === current.id) {
        const promoted = rotateRight(nextNodes, parent.id);
        steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 右旋', detail: '先右旋把折线形转换为直线形。', focusIds: [parent.id, current.id, promoted] });
      }
      const newRoot = rotateLeft(nextNodes, grand.id);
      const rootNode = nodeById(nextNodes, newRoot);
      const oldGrand = nodeById(nextNodes, grand.id);
      if (rootNode) rootNode.color = 'black';
      if (oldGrand) oldGrand.color = 'red';
      steps.push({ nodes: cloneTreeNodes(nextNodes), label: '插入节点 · 左旋并着色', detail: '左旋并交换颜色，消除连续红节点。', focusIds: [newRoot, grand.id] });
    }
    break;
  }
  const root = nextNodes.find((node) => node.parentId === null);
  if (root) root.color = 'black';
  recalculateTreeMetadata(nextNodes);
  return { nodes: nextNodes, steps };
}

function splayNode(nodes: TreeNode[], targetId: string): TreeStep[] {
  const steps: TreeStep[] = [];
  while (nodeById(nodes, targetId)?.parentId) {
    const target = nodeById(nodes, targetId);
    const parent = nodeById(nodes, target?.parentId);
    const grand = nodeById(nodes, parent?.parentId);
    if (!target || !parent) break;
    if (!grand) {
      const promoted = parent.leftId === target.id ? rotateRight(nodes, parent.id) : rotateLeft(nodes, parent.id);
      steps.push({ nodes: cloneTreeNodes(nodes), label: '访问节点 · Zig 旋转', detail: `把访问到的节点 ${target.label} 旋到根附近。`, focusIds: [target.id, promoted] });
      continue;
    }
    if (grand.leftId === parent.id && parent.leftId === target.id) {
      rotateRight(nodes, grand.id);
      const promoted = rotateRight(nodes, parent.id);
      steps.push({ nodes: cloneTreeNodes(nodes), label: '访问节点 · Zig-Zig', detail: `连续两次右旋，把 ${target.label} 沿左侧路径提升。`, focusIds: [target.id, promoted] });
    } else if (grand.rightId === parent.id && parent.rightId === target.id) {
      rotateLeft(nodes, grand.id);
      const promoted = rotateLeft(nodes, parent.id);
      steps.push({ nodes: cloneTreeNodes(nodes), label: '访问节点 · Zig-Zig', detail: `连续两次左旋，把 ${target.label} 沿右侧路径提升。`, focusIds: [target.id, promoted] });
    } else if (grand.leftId === parent.id && parent.rightId === target.id) {
      rotateLeft(nodes, parent.id);
      const promoted = rotateRight(nodes, grand.id);
      steps.push({ nodes: cloneTreeNodes(nodes), label: '访问节点 · Zig-Zag', detail: `先左旋再右旋，把折线路径转换为根节点。`, focusIds: [target.id, promoted] });
    } else {
      rotateRight(nodes, parent.id);
      const promoted = rotateLeft(nodes, grand.id);
      steps.push({ nodes: cloneTreeNodes(nodes), label: '访问节点 · Zig-Zag', detail: `先右旋再左旋，把折线路径转换为根节点。`, focusIds: [target.id, promoted] });
    }
  }
  recalculateTreeMetadata(nodes);
  return steps;
}

function splayInsert(nodes: TreeNode[], value: string): { nodes: TreeNode[]; steps: TreeStep[]; insertedId: string } {
  const nextNodes = cloneTreeNodes(nodes);
  const existing = nextNodes.find((node) => node.label === value);
  const insertedId = existing?.id ?? insertTreeValue(nextNodes, value);
  const steps = splayNode(nextNodes, insertedId);
  recalculateTreeMetadata(nextNodes);
  return { nodes: nextNodes, steps, insertedId };
}

function rangeBounds(label: string) {
  const match = label.match(/\[(\d+),\s*(\d+)\]/);
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

function rangeFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  if (operation.key === 'query-range') {
    const start = Math.max(0, Math.trunc(parseNumber(inputs.start) ?? 0));
    const end = Math.max(start, Math.trunc(parseNumber(inputs.end) ?? start));
    const related = model.nodes.filter((node) => {
      const bounds = rangeBounds(node.label);
      return bounds && bounds.end >= start && bounds.start <= end;
    });
    const frames = related.map((node) => makeFrame(model, `${operation.label} · 访问`, `检查范围 ${node.label} 是否与目标 [${start}, ${end}] 相交。`, [node.id], 'neutral'));
    return [...frames, makeFrame(model, operation.label, related.length > 0 ? `目标范围 [${start}, ${end}] 找到 ${related.length} 个相关节点。` : '目标范围没有对应节点。', related.map((node) => node.id), related.length > 0 ? 'success' : 'warning')];
  }
  if (operation.key === 'update-point') {
    const values = collectTreeValues(model.nodes, definition);
    const index = Math.max(0, Math.min(values.length - 1, Math.trunc(parseNumber(inputs.index) ?? 0)));
    const value = inputValue(inputs, 'value', '0');
    if (values.length === 0) return [makeFrame(model, operation.label, '当前范围树没有叶子节点。', [], 'warning')];
    const previous = values[index];
    values[index] = value;
    const nextNodes = buildRangeTree(values);
    return [makeFrame(model, `${operation.label} · 定位`, `定位到下标 ${index}，原值为 ${previous}。`, model.nodes.filter((node) => node.label === `[${index}, ${index}]`).map((node) => node.id), 'neutral'), makeFrame({ ...model, nodes: nextNodes }, operation.label, `下标 ${index} 已更新为 ${value}，父范围的聚合值随之回溯更新。`, nextNodes.filter((node) => node.label === `[${index}, ${index}]`).map((node) => node.id))];
  }
  return treeFrames(definition, model, operation, inputs);
}

function treeFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const value = inputValue(inputs, 'value', '64');
  const result: LabFrame[] = [];
  if (RANGE_TREE_KEYS.includes(definition.key) && ['query-range', 'update-point'].includes(operation.key)) return rangeFrames(definition, model, operation, inputs);
  if (operation.key === 'find' && definition.key === 'splay') {
    const path = treePath(model.nodes, value, definition);
    path.forEach((node) => result.push(makeFrame(model, `${operation.label} · 比较`, `比较节点 ${node.label}。`, [node.id], 'neutral')));
    const found = model.nodes.find((node) => node.label === value);
    if (!found) return [...result, makeFrame(model, operation.label, `没有找到节点 ${value}，树保持不变。`, [], 'warning')];
    const nextNodes = cloneTreeNodes(model.nodes);
    const steps = splayNode(nextNodes, found.id);
    const rotations = steps.map((step) => makeFrame({ ...model, nodes: step.nodes }, step.label, step.detail, step.focusIds, 'neutral'));
    return [...result, ...rotations, makeFrame({ ...model, nodes: nextNodes }, operation.label, `找到 ${value}，并把它伸展到根节点。`, [found.id])];
  }
  if (operation.key === 'find') {
    const path = treePath(model.nodes, value, definition);
    path.forEach((node) => result.push(makeFrame(model, `${operation.label} · 比较`, `比较节点 ${node.label}。`, [node.id], 'neutral')));
    const foundNode = model.nodes.find((node) => treeKeys(node).includes(value) || node.label === value);
    result.push(makeFrame(model, operation.label, foundNode ? `找到节点 ${value}。` : `没有找到节点 ${value}。`, foundNode ? [foundNode.id] : [], foundNode ? 'success' : 'warning'));
    return result;
  }
  if (operation.key === 'traverse') {
    const queue = model.nodes.filter((node) => node.parentId === null);
    const visited: TreeNode[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.push(current);
      const left = current.leftId ? model.nodes.find((node) => node.id === current.leftId) : undefined;
      const right = current.rightId ? model.nodes.find((node) => node.id === current.rightId) : undefined;
      if (left) queue.push(left);
      if (right) queue.push(right);
      (current.childrenIds ?? []).forEach((childId) => {
        const child = model.nodes.find((node) => node.id === childId);
        if (child && !queue.includes(child)) queue.push(child);
      });
    }
    visited.forEach((node, index) => result.push(makeFrame(model, `${operation.label} · 第 ${index + 1} 个`, `访问节点 ${node.label}。`, [node.id], 'neutral')));
    return [...result, makeFrame(model, operation.label, `层序遍历完成，共访问 ${visited.length} 个节点。`, visited.map((node) => node.id))];
  }
  if (operation.key === 'delete') {
    const found = model.nodes.some((node) => treeKeys(node).includes(value) || node.label === value);
    if (!found) return [makeFrame(model, operation.label, `没有找到节点 ${value}，树保持不变。`, [], 'warning')];
    const remaining = collectTreeValues(model.nodes, definition).filter((item) => item !== value);
    const nextNodes = buildTreeForDefinition(definition, remaining);
    return [makeFrame(model, `${operation.label} · 定位`, `找到节点 ${value}，准备按当前结构规则重连。`, treePath(model.nodes, value, definition).map((node) => node.id), 'neutral'), makeFrame({ ...model, nodes: nextNodes }, operation.label, `已删除节点 ${value}，结构重新整理完成。`, [])];
  }
  const currentValues = collectTreeValues(model.nodes, definition);
  if (currentValues.length >= MAX_VISUAL_ITEMS) return [makeFrame(model, operation.label, `可视化最多展示 ${MAX_VISUAL_ITEMS} 个元素，请先删除一些节点。`, [], 'warning')];
  if (operation.key === 'insert' && definition.key === 'avl') {
    const pathFrame = makeFrame(model, `${operation.label} · 定位`, `按 AVL 树的比较规则寻找插入位置，并检查回溯路径上的高度差。`, treePath(model.nodes, value, definition).map((node) => node.id), 'neutral');
    const result = avlInsert(model.nodes, value);
    const rotationFrames = result.steps.map((step) => makeFrame({ ...model, nodes: step.nodes }, step.label, step.detail, step.focusIds, 'neutral'));
    return [pathFrame, ...rotationFrames, makeFrame({ ...model, nodes: result.nodes }, operation.label, `节点 ${value} 已加入，所有受影响节点的平衡因子都已恢复。`, result.nodes.filter((node) => node.label === value).map((node) => node.id))];
  }
  if (operation.key === 'insert' && definition.key === 'red-black') {
    const pathFrame = makeFrame(model, `${operation.label} · 定位`, '按二叉搜索树规则找到位置，新节点先以红色加入。', treePath(model.nodes, value, definition).map((node) => node.id), 'neutral');
    const result = redBlackInsert(model.nodes, value);
    const fixFrames = result.steps.map((step) => makeFrame({ ...model, nodes: step.nodes }, step.label, step.detail, step.focusIds, 'neutral'));
    return [pathFrame, ...fixFrames, makeFrame({ ...model, nodes: result.nodes }, operation.label, `节点 ${value} 已加入，根为黑色且红色节点规则已恢复。`, result.nodes.filter((node) => node.label === value).map((node) => node.id))];
  }
  if (operation.key === 'insert' && definition.key === 'splay') {
    const pathFrame = makeFrame(model, `${operation.label} · 定位`, '按二叉搜索树规则找到位置，然后把访问节点伸展到根。', treePath(model.nodes, value, definition).map((node) => node.id), 'neutral');
    const result = splayInsert(model.nodes, value);
    const rotationFrames = result.steps.map((step) => makeFrame({ ...model, nodes: step.nodes }, step.label, step.detail, step.focusIds, 'neutral'));
    return [pathFrame, ...rotationFrames, makeFrame({ ...model, nodes: result.nodes }, operation.label, `节点 ${value} 已加入并伸展到根。`, [result.insertedId])];
  }
  const nextNodes = buildTreeForDefinition(definition, [...currentValues, value]);
  const rule = isMultiwayTree(definition) ? '按多路节点的分裂规则整理' : isBalancedTree(definition) ? '按平衡规则重新调整' : definition.key === 'cartesian-tree' ? '按最小堆优先级重建' : '按父子关系插入';
  return [makeFrame(model, `${operation.label} · 定位`, `按 ${definition.name} 的规则寻找插入位置。`, treePath(model.nodes, value, definition).map((node) => node.id), 'neutral'), makeFrame({ ...model, nodes: nextNodes }, operation.label, `节点 ${value} 已加入，${rule}完成。`, nextNodes.filter((node) => treeKeys(node).includes(value) || node.label === value).map((node) => node.id))];
}

function heapFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const values = model.values.map(Number).filter(Number.isFinite);
  const arity = heapArity(definition);
  const result: LabFrame[] = [];
  if (operation.key === 'peek') {
    return [makeFrame(model, operation.label, values.length > 0 ? `当前堆顶是 ${values[0]}。` : '堆为空。', values.length > 0 ? ['heap-0'] : [], values.length > 0 ? 'success' : 'warning')];
  }
  if (operation.key === 'extract') {
    if (values.length === 0) return [makeFrame(model, operation.label, '堆为空，无法取出元素。', [], 'warning')];
    const removed = values[0];
    values[0] = values[values.length - 1];
    values.pop();
    siftDown(values, 0, arity);
    return [makeFrame(model, `${operation.label} · 取出`, `移除堆顶 ${removed}，把最后一个元素移到根。`, ['heap-0'], 'neutral'), makeFrame({ ...model, values: values.map(String) }, operation.label, `已取出 ${removed}，堆序恢复。`, values.length > 0 ? ['heap-0'] : [])];
  }
  const value = parseNumber(inputs.value) ?? 64;
  values.push(value);
  let index = values.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / arity);
    if (values[parent] <= values[index]) break;
    [values[parent], values[index]] = [values[index], values[parent]];
    result.push(makeFrame({ ...model, values: values.map(String) }, `${operation.label} · 向上调整`, `交换节点 ${values[parent]} 和父节点。`, [`heap-${parent}`, `heap-${index}`], 'neutral'));
    index = parent;
  }
  return [...result, makeFrame({ ...model, values: values.map(String) }, operation.label, `${value} 已插入，堆序保持正确。`, [`heap-${index}`])];
}

function triePath(nodes: TrieNode[], word: string) {
  const path: TrieNode[] = [nodes[0]];
  let parent = nodes[0];
  for (const character of word.toUpperCase()) {
    const child = nodes.find((node) => node.parentId === parent.id && node.label === character);
    if (!child) break;
    path.push(child);
    parent = child;
  }
  return path;
}

function trieFrames(model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const word = inputValue(inputs, 'text', 'DATA').toUpperCase();
  const path = triePath(model.trieNodes, word);
  const scanFrames = path.map((node, index) => makeFrame(model, `${operation.label} · 字符 ${index + 1}`, `检查字符 ${node.label}。`, [node.id], 'neutral'));
  if (operation.key === 'find-word') {
    const found = path.length === word.length + 1 && path[path.length - 1].terminal;
    return [...scanFrames, makeFrame(model, operation.label, found ? `找到单词 ${word}。` : `没有找到单词 ${word}。`, found ? [path[path.length - 1].id] : [], found ? 'success' : 'warning')];
  }
  if (operation.key === 'delete-word') {
    const nextNodes = model.trieNodes.map((node) => ({ ...node, children: [...node.children] }));
    const terminal = nextNodes.find((node) => node.id === path[path.length - 1]?.id);
    if (!terminal || !terminal.terminal || path.length !== word.length + 1) return [...scanFrames, makeFrame(model, operation.label, `没有找到单词 ${word}。`, [], 'warning')];
    terminal.terminal = false;
    return [...scanFrames, makeFrame({ ...model, trieNodes: nextNodes }, operation.label, `已取消 ${word} 的终点标记。`, [terminal.id])];
  }
  const nextNodes = model.trieNodes.map((node) => ({ ...node, children: [...node.children] }));
  insertTrieWord(nextNodes, word);
  return [...scanFrames, makeFrame({ ...model, trieNodes: nextNodes }, operation.label, `单词 ${word} 已写入字符路径。`, triePath(nextNodes, word).map((node) => node.id))];
}

function graphFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  if (operation.key === 'add-edge') {
    const from = inputValue(inputs, 'start', model.vertices[0] ?? 'A');
    const to = inputValue(inputs, 'end', model.vertices[1] ?? 'B');
    const nextEdges = [...model.edges];
    const existing = nextEdges.find((edge) => edge.from === from && edge.to === to && definition.key !== 'multigraph');
    if (!existing) nextEdges.push({ id: `edge-${nextEdges.length}`, from, to, weight: nextEdges.length + 1 });
    const nextVertices = Array.from(new Set([...model.vertices, from, to])).slice(0, 8);
    const nextModel = { ...model, vertices: nextVertices, edges: nextEdges, rows: graphRows(definition, nextVertices, nextEdges) };
    if (['adjacency-matrix', 'incidence-matrix'].includes(definition.key)) nextModel.matrix = graphRepresentationMatrix(definition, nextVertices, nextEdges);
    return [makeFrame(model, operation.label, existing ? `边 ${from} → ${to} 已经存在。` : `连接顶点 ${from} 和 ${to}。`, [`vertex-${from}`, `vertex-${to}`], 'neutral'), makeFrame(nextModel, operation.label, existing ? '结构保持不变。' : `已经添加边 ${from} → ${to}。`, existing ? [] : [`edge-${nextEdges.length - 1}`])];
  }
  const start = model.vertices[0];
  const visited: string[] = [];
  const pending = start ? [start] : [];
  const directed = graphIsDirected(definition);
  const neighbors = (vertex: string) => model.edges.flatMap((edge) => edge.from === vertex ? [edge.to] : !directed && edge.to === vertex ? [edge.from] : []);
  while (pending.length > 0) {
    const current = operation.key === 'bfs' ? pending.shift()! : pending.pop()!;
    if (visited.includes(current)) continue;
    visited.push(current);
    neighbors(current).forEach((neighbor) => { if (!visited.includes(neighbor)) pending.push(neighbor); });
  }
  const frames = visited.map((vertex, index) => makeFrame({ ...model, visited: visited.slice(0, index + 1) }, `${operation.label} · 第 ${index + 1} 个`, `${operation.key === 'bfs' ? '从队列取出' : '从栈顶取出'}顶点 ${vertex}。`, [`vertex-${vertex}`], 'neutral'));
  return [...frames, makeFrame({ ...model, visited }, operation.label, `遍历完成，访问顺序为：${visited.join(' → ')}。`, visited.map((vertex) => `vertex-${vertex}`))];
}

function findRoot(parents: number[], index: number, compress = true) {
  let root = index;
  while (parents[root] !== root) root = parents[root];
  if (compress) {
    let current = index;
    while (parents[current] !== current) {
      const next = parents[current];
      parents[current] = root;
      current = next;
    }
  }
  return root;
}

function dsuFrames(model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const parents = model.parents.length > 0 ? [...model.parents] : [0, 1, 2, 3, 4, 5];
  const ranks = model.ranks.length === parents.length ? [...model.ranks] : Array(parents.length).fill(0);
  if (operation.key === 'find-set') {
    const index = Math.max(0, Math.min(parents.length - 1, Math.trunc(parseNumber(inputs.index) ?? 0)));
    const path: number[] = [];
    let current = index;
    while (!path.includes(current)) {
      path.push(current);
      if (parents[current] === current) break;
      current = parents[current];
    }
    const compressed = [...parents];
    const root = findRoot(compressed, index, true);
    const frames = path.map((item) => makeFrame(model, `${operation.label} · 路径`, `沿 parent 从 ${item} 向上查找。`, [`dsu-${item}`], 'neutral'));
    return [...frames, makeFrame({ ...model, parents: compressed, ranks }, operation.label, `元素 ${index} 的代表元是 ${root}，路径已压缩。`, [`dsu-${root}`])];
  }
  const first = Math.max(0, Math.min(parents.length - 1, Math.trunc(parseNumber(inputs.row) ?? 0)));
  const second = Math.max(0, Math.min(parents.length - 1, Math.trunc(parseNumber(inputs.column) ?? 1)));
  const firstRoot = findRoot(parents, first, true);
  const secondRoot = findRoot(parents, second, true);
  if (firstRoot !== secondRoot) {
    if (ranks[firstRoot] < ranks[secondRoot]) parents[firstRoot] = secondRoot;
    else if (ranks[firstRoot] > ranks[secondRoot]) parents[secondRoot] = firstRoot;
    else { parents[secondRoot] = firstRoot; ranks[firstRoot] += 1; }
  }
  return [makeFrame(model, `${operation.label} · 找代表元`, `找到 ${first} 的代表元 ${firstRoot}，找到 ${second} 的代表元 ${secondRoot}。`, [`dsu-${firstRoot}`, `dsu-${secondRoot}`], 'neutral'), makeFrame({ ...model, parents, ranks }, operation.label, firstRoot === secondRoot ? '两个元素已经属于同一个集合。' : `已把 ${first} 和 ${second} 所在集合合并。`, [`dsu-${findRoot(parents, first)}`])];
}

function textFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const result: LabFrame[] = [];
  if (operation.key === 'clear') {
    const next = { ...model, text: '', rows: [] };
    return [makeFrame(model, operation.label, '清空当前文本。', [], 'neutral'), makeFrame(next, operation.label, '文本已经清空。', [])];
  }
  const value = inputValue(inputs, 'text', 'TREE');
  if (operation.key === 'search') {
    const index = model.text.toUpperCase().indexOf(value.toUpperCase());
    [...model.text].forEach((character, currentIndex) => result.push(makeFrame(model, `${operation.label} · 扫描`, `检查第 ${currentIndex} 个字符：${character}。`, [`char-${currentIndex}`], 'neutral')));
    return [...result, makeFrame(model, operation.label, index >= 0 ? `在位置 ${index} 找到“${value}”。` : `没有找到“${value}”。`, index >= 0 ? Array.from({ length: value.length }, (_, offset) => `char-${index + offset}`) : [], index >= 0 ? 'success' : 'warning')];
  }
  const separator = definition.key === 'string-array' ? (model.text.length > 0 ? ' ' : '') : '';
  const next = { ...model, text: model.text + separator + value };
  refreshRows(next, definition.key);
  return [makeFrame(next, operation.label, `已把“${value}”追加到文本末尾。`, Array.from({ length: value.length }, (_, index) => `char-${model.text.length + separator.length + index}`))];
}

function matrixFrames(definition: StructureDefinition, model: LabModel, operation: OperationDefinition, inputs: Record<string, string>): LabFrame[] {
  const row = Math.max(0, Math.min(model.matrix.length - 1, Math.trunc(parseNumber(inputs.row) ?? 0)));
  const column = Math.max(0, Math.min((model.matrix[row]?.length ?? 1) - 1, Math.trunc(parseNumber(inputs.column) ?? 0)));
  const cellId = `cell-${row}-${column}`;
  if (operation.key === 'read-cell') return [makeFrame(model, operation.label, `第 ${row} 行、第 ${column} 列的值是 ${model.matrix[row]?.[column] ?? ''}。`, [cellId])];
  if (operation.key === 'transpose') {
    const next = model.matrix[0]?.map((_, columnIndex) => model.matrix.map((line) => line[columnIndex])) ?? [];
    const nextModel = { ...model, matrix: next };
    refreshMatrixRows(nextModel, definition.key);
    return [makeFrame(model, `${operation.label} · 交换`, '正在交换行和列的对应位置。', [], 'neutral'), makeFrame(nextModel, operation.label, '矩阵已经完成转置。', [])];
  }
  const next = model.matrix.map((line) => [...line]);
  next[row][column] = inputValue(inputs, 'value', '0');
  const nextModel = { ...model, matrix: next };
  refreshMatrixRows(nextModel, definition.key);
  return [makeFrame(nextModel, operation.label, `已把第 ${row} 行、第 ${column} 列改为 ${next[row][column]}。`, [cellId])];
}

export function executeOperation(
  definition: StructureDefinition,
  frame: LabFrame,
  operationKey: string,
  inputs: Record<string, string>,
): LabFrame[] {
  const model = frame.model;
  const operation = operationFor(definition, operationKey);
  switch (definition.visualFamily) {
    case 'sequence': return sequenceFrames(definition, model, operation, inputs);
    case 'linked': return linkedFrames(definition, model, operation, inputs);
    case 'stack': return stackFrames(definition, model, operation, inputs);
    case 'queue': return queueFrames(definition, model, operation, inputs);
    case 'hash': return hashFrames(definition, model, operation, inputs);
    case 'bits': return bitFrames(model, operation, inputs);
    case 'filter': return filterFrames(model, operation, inputs);
    case 'sketch': return sketchFrames(definition, model, operation, inputs);
    case 'tree': return treeFrames(definition, model, operation, inputs);
    case 'heap': return heapFrames(definition, model, operation, inputs);
    case 'trie': return trieFrames(model, operation, inputs);
    case 'graph': return graphFrames(definition, model, operation, inputs);
    case 'dsu': return dsuFrames(model, operation, inputs);
    case 'text': return textFrames(definition, model, operation, inputs);
    case 'matrix': return matrixFrames(definition, model, operation, inputs);
    default: return [makeFrame(model, operation.label, '当前结构暂时没有可执行的操作。', [], 'warning')];
  }
}
