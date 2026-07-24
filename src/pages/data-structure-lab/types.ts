export type LabCategory = 'linear' | 'hash' | 'tree' | 'graph' | 'string' | 'matrix';

export type VisualFamily =
  | 'sequence'
  | 'linked'
  | 'stack'
  | 'queue'
  | 'hash'
  | 'bits'
  | 'filter'
  | 'sketch'
  | 'tree'
  | 'heap'
  | 'trie'
  | 'graph'
  | 'dsu'
  | 'text'
  | 'matrix';

export type OperationFieldKey =
  | 'value'
  | 'index'
  | 'key'
  | 'text'
  | 'start'
  | 'end'
  | 'row'
  | 'column';

export interface OperationField {
  key: OperationFieldKey;
  label: string;
  placeholder: string;
  type?: 'number' | 'text';
}

export interface OperationDefinition {
  key: string;
  label: string;
  description: string;
  fields?: OperationField[];
}

export interface StructureDefinition {
  key: string;
  name: string;
  englishName: string;
  category: LabCategory;
  group: string;
  visualFamily: VisualFamily;
  iconKey: string;
  description: string;
  beginnerNote: string;
  learn: string;
  complexity: string;
  defaultInput: string;
  inputHint: string;
  operations: OperationDefinition[];
  maxItems?: number;
}

export interface TreeNode {
  id: string;
  label: string;
  parentId: string | null;
  leftId?: string | null;
  rightId?: string | null;
  childrenIds?: string[];
  keys?: string[];
  color?: 'red' | 'black';
  priority?: number;
  size?: number;
  depth: number;
  terminal?: boolean;
}

export interface TrieNode {
  id: string;
  label: string;
  parentId: string | null;
  children: string[];
  depth: number;
  terminal: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  weight?: number;
}

export interface HashBucket {
  index: number;
  entries: string[];
}

export interface LabModel {
  values: string[];
  text: string;
  capacity: number;
  headIndex: number;
  tailIndex: number;
  buckets: HashBucket[];
  counters: number[];
  bits: number[];
  nodes: TreeNode[];
  trieNodes: TrieNode[];
  vertices: string[];
  edges: GraphEdge[];
  visited: string[];
  matrix: string[][];
  parents: number[];
  ranks: number[];
  rows: string[];
}

export type FrameStatus = 'neutral' | 'success' | 'warning';

export interface LabFrame {
  model: LabModel;
  operationLabel: string;
  detail: string;
  focusIds: string[];
  status: FrameStatus;
}
