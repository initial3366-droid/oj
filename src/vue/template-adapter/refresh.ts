import { adminPath } from '../../utils/adminPath';
export function refreshPath(fullPath: string) {
  const prefix = fullPath.startsWith(adminPath('/')) ? adminPath('') : fullPath.startsWith('/teacher/') ? '/teacher' : '';
  return `${prefix}/redirect${fullPath}`;
}
