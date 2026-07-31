/**
 * DataTable组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { Table, TableColumnProps, Space, Button, Input } from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';
import { useState, ReactNode } from 'react';

/**
 * DataTableProps接口，明确该模块内部及 API 边界使用的数据结构。
 */
interface DataTableProps<T> {
  columns: TableColumnProps[];
  data: T[];
  loading?: boolean;
  pagination?: boolean | object;
  rowKey?: string | ((record: T) => string);
  onRefresh?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (value: string) => void;
  extraActions?: ReactNode;
  rowSelection?: object;
}

/**
 * 渲染DataTable组件，并协调其数据加载、状态和交互。
 */
export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  pagination = true,
  rowKey = 'id',
  onRefresh,
  searchable = false,
  searchPlaceholder = '搜索...',
  onSearch,
  extraActions,
  rowSelection,
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState('');

  /**
   * 处理Search。保持输入与返回值转换集中，避免调用处重复实现同一规则。
   */
  const handleSearch = () => {
    if (onSearch) {
      onSearch(searchValue);
    }
  };

  return (
    <div>
      {(searchable || onRefresh || extraActions) && (
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            {searchable && (
              <Input.Search
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={setSearchValue}
                onSearch={handleSearch}
                style={{ width: 300 }}
                searchButton
              />
            )}
          </Space>
          <Space>
            {extraActions}
            {onRefresh && (
              <Button icon={<IconRefresh />} onClick={onRefresh}>
                刷新
              </Button>
            )}
          </Space>
        </div>
      )}

      <Table
        columns={columns}
        data={data}
        loading={loading}
        pagination={
          pagination === true
            ? {
                showTotal: true,
                showJumper: true,
                sizeCanChange: true,
              }
            : pagination
        }
        rowKey={rowKey}
        rowSelection={rowSelection}
        border={{
          wrapper: true,
          cell: true,
        }}
      />
    </div>
  );
}
