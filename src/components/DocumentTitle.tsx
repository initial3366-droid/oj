/**
 * 文档标题组件。封装可复用的界面结构、展示规则及交互行为。
 */
import { useEffect, useMemo, useState } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { fetchSiteTitle } from "../data/apiClient";
import { ADMIN_PREFIX } from "../config";

const DEFAULT_SITE_TITLE = "QOJ 在线评测系统";

/**
 * 路由标题类型别名，明确该模块内部及 API 边界使用的数据结构。
 */
type RouteTitle = {
  pattern: string;
  title: string;
  end?: boolean;
  hideSiteTitle?: boolean;
};

const routeTitles: RouteTitle[] = [
  { pattern: "/", title: "首页", end: true },
  { pattern: "/problems", title: "题库", end: true },
  { pattern: "/problems/:problemId/submissions", title: "题目提交记录" },
  { pattern: "/practice", title: "题单", end: true },
  { pattern: "/practice/problem/:problemId", title: "写代码" },
  { pattern: "/practice/:practiceId", title: "题单详情", end: true },
  { pattern: "/contests", title: "比赛", end: true },
  { pattern: "/contests/:contestId", title: "比赛详情", end: true },
  { pattern: "/contests/:contestId/scoreboard", title: "比赛榜单" },
  { pattern: "/contests/:contestId/public-scoreboard", title: "公开榜单" },
  { pattern: "/leaderboard", title: "排行榜" },
  { pattern: "/submission-queue", title: "提交队列" },
  { pattern: "/users/:userId", title: "用户主页" },
  { pattern: "/user-center", title: "用户中心" },
  { pattern: "/profile", title: "用户中心" },
  { pattern: "/login", title: "登录" },
  { pattern: "/register", title: "注册" },

  /* ── Admin ── */
  { pattern: `/${ADMIN_PREFIX}/login`, title: "后台登录", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/dashboard`, title: "Dashboard", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/users/students`, title: "学生列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/users/teachers`, title: "教师列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/majors`, title: "专业管理", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problems/new`, title: "添加题目", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problems/:problemId/edit`, title: "编辑题目", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problems/:problemId/test-cases`, title: "测试数据", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problems`, title: "题目列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problem-folders/new`, title: "题目文件夹", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problem-folders/:folderId`, title: "题目文件夹", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/problem-folders`, title: "题目文件夹", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/practices/new`, title: "创建题单", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/practices/:practiceId/publish`, title: "发布题单", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/practices/:practiceId/edit`, title: "编辑题单", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/practices`, title: "题单列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/new`, title: "创建比赛", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/rankings`, title: "比赛排行", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/:contestId/submissions`, title: "提交记录", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/:contestId/judge/queue`, title: "判题队列", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/:contestId/edit`, title: "编辑比赛", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests/:contestId`, title: "比赛详情", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/contests`, title: "比赛列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/submissions/statistics`, title: "提交统计", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/submissions`, title: "提交列表", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/judge/queue`, title: "判题队列", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/submission-queue`, title: "判题队列", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/judge/config`, title: "判题配置", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/leaderboard`, title: "全站榜单", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/classes/:classId`, title: "班级详情", hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/classes`, title: "班级管理", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/settings/frontend`, title: "前端配置", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/settings/register`, title: "注册配置", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/settings/system`, title: "系统配置", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/settings/announcements`, title: "公告管理", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/profile`, title: "个人信息", end: true, hideSiteTitle: true },
  { pattern: `/${ADMIN_PREFIX}/*`, title: "后台管理", hideSiteTitle: true },

  /* ── Teacher ── */
  { pattern: "/teacher/login", title: "教师端登录", hideSiteTitle: true },
  { pattern: "/teacher/dashboard", title: "首页", end: true, hideSiteTitle: true },
  { pattern: "/teacher/classes", title: "班级管理", end: true, hideSiteTitle: true },
  { pattern: "/teacher/students", title: "学生列表", end: true, hideSiteTitle: true },
  { pattern: "/teacher/import", title: "导入学生", end: true, hideSiteTitle: true },
  { pattern: "/teacher/applications", title: "加入申请", end: true, hideSiteTitle: true },
  { pattern: "/teacher/submissions", title: "提交记录", end: true, hideSiteTitle: true },
  { pattern: "/teacher/stats", title: "练习统计", end: true, hideSiteTitle: true },
  { pattern: "/teacher/practices/submissions", title: "提交记录", end: true, hideSiteTitle: true },
  { pattern: "/teacher/practices/new", title: "创建题单", end: true, hideSiteTitle: true },
  { pattern: "/teacher/practices/:practiceId/publish", title: "发布题单", hideSiteTitle: true },
  { pattern: "/teacher/practices/:practiceId/edit", title: "编辑题单", hideSiteTitle: true },
  { pattern: "/teacher/practices/:practiceId/report", title: "练习报告", hideSiteTitle: true },
  { pattern: "/teacher/practices", title: "题单列表", end: true, hideSiteTitle: true },
  { pattern: "/teacher/problems/new", title: "创建题目", end: true, hideSiteTitle: true },
  { pattern: "/teacher/problems/:problemId/edit", title: "编辑题目", hideSiteTitle: true },
  { pattern: "/teacher/problems/:problemId/test-cases", title: "测试数据", hideSiteTitle: true },
  { pattern: "/teacher/problems", title: "题目列表", end: true, hideSiteTitle: true },
  { pattern: "/teacher/problem-folders/new", title: "题目文件夹", end: true, hideSiteTitle: true },
  { pattern: "/teacher/problem-folders/:folderId", title: "题目文件夹", hideSiteTitle: true },
  { pattern: "/teacher/problem-folders", title: "题目文件夹", end: true, hideSiteTitle: true },
  { pattern: "/teacher/contests/new", title: "创建比赛", end: true, hideSiteTitle: true },
  { pattern: "/teacher/contests/:contestId/edit", title: "编辑比赛", hideSiteTitle: true },
  { pattern: "/teacher/contests/:contestId", title: "比赛详情", hideSiteTitle: true },
  { pattern: "/teacher/contests", title: "比赛管理", end: true, hideSiteTitle: true },
  { pattern: "/teacher/profile", title: "个人信息", end: true, hideSiteTitle: true },
  { pattern: "/teacher/*", title: "教师端", hideSiteTitle: true },
];

/**
 * 封装路由EntryForPath相关逻辑。保持输入与返回值转换集中，避免调用处重复实现同一规则。
 */
function routeEntryForPath(pathname: string): RouteTitle {
  for (const item of routeTitles) {
    if (matchPath({ path: item.pattern, end: item.end ?? false }, pathname)) {
      return item;
    }
  }
  return { pattern: "", title: "页面不存在" };
}

/**
 * 渲染文档标题组件，并协调其数据加载、状态和交互。
 */
export function DocumentTitle() {
  const location = useLocation();
  const [siteTitle, setSiteTitle] = useState(DEFAULT_SITE_TITLE);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);
  /**
   * 封装路由Entry相关逻辑。对原始数据进行派生或聚合。
   */
  const routeEntry = useMemo(() => routeEntryForPath(location.pathname), [location.pathname]);
  const pageTitle = routeEntry.title;
  const hideSiteTitle = routeEntry.hideSiteTitle ?? false;
  const portalTitle = location.pathname.startsWith(`/${ADMIN_PREFIX}`)
    ? "后台管理"
    : location.pathname.startsWith("/teacher")
      ? "教师端"
      : null;
  const portal = location.pathname.startsWith(`/${ADMIN_PREFIX}`)
    ? "admin"
    : location.pathname.startsWith("/teacher")
      ? "teacher"
      : null;

  useEffect(() => {
    if (portal) {
      document.body.dataset.qojPortal = portal;
    } else {
      delete document.body.dataset.qojPortal;
    }

    return () => {
      if (document.body.dataset.qojPortal === portal) {
        delete document.body.dataset.qojPortal;
      }
    };
  }, [portal]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteTitle()
      .then((title) => {
        if (!cancelled && title.trim()) {
          setSiteTitle(title.trim());
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setTitleOverride(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    /**
     * 处理on标题Override。会更新 React 状态并触发重新渲染。
     */
    const onTitleOverride = (event: Event) => {
      const title = (event as CustomEvent<{ title?: string | null }>).detail?.title?.trim();
      setTitleOverride(title || null);
    };
    window.addEventListener("qoj:document-title", onTitleOverride);
    return () => {
      window.removeEventListener("qoj:document-title", onTitleOverride);
    };
  }, []);

  useEffect(() => {
    const title = titleOverride ?? pageTitle;
    if (portalTitle) {
      document.title = title === portalTitle ? portalTitle : `${title} - ${portalTitle}`;
    } else if (hideSiteTitle) {
      document.title = title;
    } else {
      document.title = title === "首页" ? siteTitle : `${title} - ${siteTitle}`;
    }
  }, [pageTitle, siteTitle, titleOverride, hideSiteTitle, portalTitle]);

  return null;
}
