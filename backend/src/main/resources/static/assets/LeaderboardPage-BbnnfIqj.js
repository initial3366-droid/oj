import{u as C,r as l,j as e,T as t}from"./index-CjEuB_Aq.js";import{A as I}from"./index-CxiGwwIF.js";import{B as T}from"./index-VgqGkd4m.js";import{B as N}from"./index-BOfHQ7uh.js";import{C as h}from"./index-DJzC9TRx.js";import{S as g}from"./index-BNJqNuTR.js";import{T as y}from"./index-DaNzPdwU.js";import{P as A}from"./PageContainer-CWGrR2bu.js";import"./monacoSetup-B9055LeW.js";import{a as f}from"./client-BvmjKeb1.js";import{I as S}from"./IconRefresh-D0DnI15W.js";import"./constants-CM3vpuO1.js";import"./IconClose-Dl7Dhu4-.js";import"./IconTickCircle-K_ckxICg.js";import"./index-DJGO3l4o.js";import"./isNumber-CxM_BkBT.js";import"./_baseDifference-CB9W1rdB.js";import"./index-BuEfjDgW.js";import"./inheritsLoose-9nDL0a-7.js";import"./isEqualWith-CfbII0jA.js";import"./IconTreeTriangleDown-Dkia71Jx.js";async function R(a=10){return f(`/api/v1/leaderboard/global?limit=${a}`)}async function $(a=100){return f(`/api/v1/leaderboard/classes?limit=${a}`)}function w(a){return a===1?"gold":a===2?"silver":a===3?"bronze":"normal"}function z(a,i){return((a==null?void 0:a.trim())||String(i??"")).charAt(0).toUpperCase()}function ee(){const a=C(),[i,s]=l.useState([]),[b,p]=l.useState([]),[n,m]=l.useState(!0),[x,u]=l.useState(""),c=l.useCallback(async()=>{m(!0);try{const[r,d]=await Promise.all([R(1e3),$(3).catch(()=>[])]);s(r.map((o,k)=>({...o,rank:k+1}))),p(d),u("")}catch(r){s([]),p([]),u(r instanceof Error?r.message:"排行榜加载失败")}finally{m(!1)}},[]);l.useEffect(()=>{c()},[c]);const j=l.useMemo(()=>[{title:"排名",dataIndex:"rank",width:96,render:r=>e.jsx("span",{className:`leaderboard-rank-badge leaderboard-rank-${w(r)}`,children:r})},{title:"用户",dataIndex:"name",width:"28%",render:(r,d)=>e.jsxs("button",{type:"button",onClick:()=>a(`/users/${d.userId}`),className:"leaderboard-table-user",style:{display:"inline-flex",alignItems:"center",gap:12,border:0,background:"transparent",padding:0,cursor:"pointer",color:"inherit"},children:[e.jsx(I,{size:"small",color:"blue",children:z(r,d.userId)}),e.jsx(t.Text,{strong:!0,ellipsis:{showTooltip:!0},children:r||`#${d.userId}`})]})},{title:"班级",dataIndex:"className",width:"18%",render:r=>e.jsx(t.Text,{type:r?"primary":"tertiary",ellipsis:{showTooltip:!0},children:r||"-"})},{title:"非比赛 AC",dataIndex:"acCount",width:"18%",render:r=>e.jsx(t.Text,{strong:!0,style:{color:"var(--semi-color-primary)"},children:r})},{title:"连续训练",dataIndex:"streak",width:"16%",render:r=>e.jsxs(t.Text,{children:[r??0," 天"]})}],[a]),v=l.useMemo(()=>[{title:"排名",width:96,render:(r,d,o)=>e.jsx("span",{className:`leaderboard-rank-badge leaderboard-rank-${w(o+1)}`,children:o+1})},{title:"班级",dataIndex:"className",render:r=>e.jsx(t.Text,{strong:!0,children:r||"-"})},{title:"教师",dataIndex:"teacherName",render:r=>e.jsx(t.Text,{children:r||"-"})},{title:"AC 数量",dataIndex:"acCount",width:160,render:r=>e.jsx(t.Text,{strong:!0,style:{color:"var(--semi-color-primary)"},children:r})}],[]);return e.jsxs(A,{title:"排行榜",subtitle:"Leaderboard",description:"只统计学生的非比赛 AC，班级榜每日 00:00 更新。",extra:e.jsx(N,{icon:e.jsx(S,{}),onClick:c,loading:n,children:"刷新"}),children:[e.jsx("style",{children:`
        .leaderboard-shell {
          display: grid;
          gap: 16px;
        }

        .leaderboard-table-card {
          border: 1px solid var(--semi-color-border);
        }

        .leaderboard-user-button {
          display: inline-flex;
          min-width: 0;
          align-items: center;
          gap: 12px;
          border: 0;
          background: transparent;
          padding: 0;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }

        .leaderboard-user-name {
          display: block;
          max-width: 160px;
        }

        .leaderboard-rank-badge {
          display: inline-grid;
          min-width: 36px;
          height: 28px;
          place-items: center;
          border-radius: 8px;
          background: var(--semi-color-fill-0);
          color: var(--semi-color-text-1);
          font-weight: 700;
          line-height: 1;
        }

        .leaderboard-rank-gold {
          background: rgba(255, 197, 61, 0.22);
          color: #9a6400;
        }

        .leaderboard-rank-silver {
          background: rgba(148, 163, 184, 0.24);
          color: #475569;
        }

        .leaderboard-rank-bronze {
          background: rgba(217, 119, 6, 0.18);
          color: #92400e;
        }

        .leaderboard-table-card .semi-card-body {
          padding: 0;
        }

        .leaderboard-table-card,
        .leaderboard-table-card .semi-card-body,
        .leaderboard-table-wrap,
        .leaderboard-table {
          width: 100%;
          min-width: 0;
        }

        .leaderboard-table-card {
          overflow: hidden;
        }

        .leaderboard-table-wrap {
          overflow-x: auto;
        }

        .leaderboard-table .semi-table-wrapper,
        .leaderboard-table .semi-table-container,
        .leaderboard-table .semi-table {
          width: 100%;
        }

        .leaderboard-table .semi-table {
          min-width: 720px;
          table-layout: fixed;
        }

        .leaderboard-table .semi-table-thead > .semi-table-row > .semi-table-row-head,
        .leaderboard-table .semi-table-tbody > .semi-table-row > .semi-table-row-cell {
          padding: 18px 20px;
        }

        .leaderboard-table .semi-table-pagination-outer {
          margin: 0;
          padding: 16px 20px;
          border-top: 1px solid var(--semi-color-border);
        }

        .leaderboard-table-user {
          width: 100%;
          min-width: 0;
        }

        .leaderboard-table-user .semi-typography {
          min-width: 0;
        }

      `}),x&&e.jsx(T,{type:"danger",description:x,closeIcon:null,style:{marginBottom:16}}),e.jsxs("div",{className:"leaderboard-shell",children:[e.jsx(h,{className:"leaderboard-table-card",title:"班级最多 AC",children:n&&b.length===0?e.jsx("div",{style:{padding:"48px 0",textAlign:"center"},children:e.jsx(g,{tip:"排行榜加载中"})}):e.jsx("div",{className:"leaderboard-table-wrap",children:e.jsx(y,{className:"leaderboard-table",dataSource:b,rowKey:"classId",pagination:!1,columns:v,empty:e.jsx("div",{style:{padding:"40px 0",textAlign:"center"},children:e.jsx(t.Text,{type:"tertiary",children:"暂无班级排行榜数据"})})})})}),e.jsx(h,{className:"leaderboard-table-card",title:"所有人排行榜",children:n&&i.length===0?e.jsx("div",{style:{padding:"48px 0",textAlign:"center"},children:e.jsx(g,{tip:"排行榜加载中"})}):e.jsx("div",{className:"leaderboard-table-wrap",children:e.jsx(y,{className:"leaderboard-table",columns:j,dataSource:i,rowKey:"userId",pagination:{pageSize:20,showSizeChanger:!0},empty:e.jsx("div",{style:{padding:"40px 0",textAlign:"center"},children:e.jsx(t.Text,{type:"tertiary",children:"暂无真实排行榜数据"})})})})})]})]})}export{ee as LeaderboardPage};
