/**
 * 教师比赛Create页面。负责组织该路由的加载状态、用户交互和业务数据展示。
 */
import { AdminContestManagementPage } from '../../admin/pages/contests/AdminContestManagementPage';

/**
 * Teachers use the same contest editor as administrators. The shared editor
 * switches to teacher authentication and loads only classes owned by the
 * current teacher; the backend repeats that ownership check on save.
 */
export function TeacherContestCreatePage() {
  return <AdminContestManagementPage portal="teacher" />;
}
