import{a as Fl,b as Fe,d as Hl,u as Kl,c as Jl,e as Xl,w as Ee,o as Yl,f as Ql,g as Zl,h as n,i as g,j as v,k as m,l as i,E as ea,m as t,n as p,p as la,q as aa,r as $,s as qe,t as pl,v as ta,x as r,F as M,y as w,z as Q,A as na,B as ua,C as oa,D as sa,G as ia,H as ra,I as fl,J as je,K as va,L as da,M as ca,N as be,O as ma,P as h,Q as u,R as pa,S as fa,T as gl,U as El,V as bl,W as ga,_ as Ea}from"./main-Clz7B1b7.js";import{E as ba}from"./index-CKGxTdXM.js";import{E as ya}from"./index-BwpskSkC.js";import{E as Ca}from"./index-KRivFF7h.js";import{E as _a,a as wa}from"./index-a2uYRx4X.js";import{f as ha,a as ka,b as yl,r as Da,s as Ta,c as Cl}from"./submission-CXRTBVwL.js";import{l as Ia,S as P,s as Sa}from"./languages-CyjYYAzJ.js";import{c as _l,V as La}from"./guide-eTBwKtbV.js";import{C as wl}from"./CodeEditor-D3FpYTzu.js";import{_ as Z}from"./HtmlMath.vue_vue_type_script_setup_true_lang-BNMtg7tI.js";import"./app-BR9PwwyB.js";import"./index-sTZgxHL_.js";function Ie(D){return D?`?practiceId=${encodeURIComponent(D)}`:""}function Ma(D,C){return Fl(`/api/v1/problems/${D}/solution${Ie(C)}`,!0)}function Oa(D,C,W){return Fe(`/api/v1/problems/${D}/solution/accept${Ie(W)}`,{level:C},!0)}function Na(D,C){return Fe(`/api/v1/problems/${D}/solution/next${Ie(C)}`,{},!0)}function Ra(D,C,W){return Fe(`/api/v1/problems/${D}/solution/view${Ie(W)}`,{level:C},!0)}const $a=`
<h3>一、什么是通信题？</h3>
<p>通信题是一种特殊的程序设计题。你提交的<strong>同一份程序会独立运行两次</strong>，分别负责发送信息和接收信息。</p>
<p>两次运行之间不能共享变量或内存，只能通过评测系统提供的通信通道传递信息。</p>
<h3>二、通信过程</h3>
<p>整个通信过程分为以下四步：</p>
<ol>
<li><strong>ENCODE：</strong>发送方读取原始数据，通过标准输出发送一条消息。</li>
<li><strong>信道程序：</strong>评测系统检查消息，并生成接收方的输入。</li>
<li><strong>DECODE：</strong>接收方读取收到的信息，完成计算。</li>
<li><strong>最终检查：</strong>评测系统检查接收方输出的答案是否正确。</li>
</ol>
<p><strong>注意：</strong>ENCODE 和 DECODE 是同一份代码的两次独立运行。</p>
<h3>三、简单通信示例</h3>
<p>下面仅演示通信过程，不代表任何具体题目的输入输出规则。</p>
<p><strong>第一步：发送方运行</strong></p>
<p>程序收到：</p>
<pre>ENCODE
10 20</pre>
<p>发送方通过标准输出发送：</p>
<pre>10 20</pre>
<p><strong>第二步：评测系统传递消息</strong></p>
<p>信道程序接收上面的消息，并构造第二次运行的输入。</p>
<pre>DECODE
10 20</pre>
<p><strong>第三步：接收方运行</strong></p>
<p>程序读取收到的两个数字，假设本示例要求计算它们的和。</p>
<p>接收方输出：</p>
<pre>30</pre>
<p><strong>第四步：评测系统检查</strong></p>
<p>最终检查器验证接收方的输出，正确则判定为 Accepted，否则判定为 Wrong Answer。</p>
<p>上述数据仅用于理解通信过程。实际比赛中的消息格式、公开数据和计算要求，以具体题目为准。</p>
<h3>四、注意事项</h3>
<ul>
<li>只需提交一份代码，评测系统会自动运行两次。</li>
<li>发送方通过标准输出发送消息。</li>
<li>接收方通过标准输入读取信息。</li>
<li>两次运行相互独立，不能共享全局变量。</li>
<li>标准输出中不能包含无关的调试信息。</li>
<li>本类通信题不是实时交互题，通常不需要手动调用 <code>cout.flush()</code>。</li>
<li>通信消息的大小和格式必须遵守题目规定。</li>
<li>本地调试信息请写入标准错误输出。</li>
</ul>
<p><strong>总结：</strong>ENCODE 负责发送信息，信道程序负责传递信息，DECODE 负责接收信息并给出最终答案。</p>
`,hl=[{language:"c",label:"C",code:`#include <stdio.h>
#include <string.h>

typedef long long ll;

// 第一次运行：发送信息
void encode(void) {

}

// 第二次运行：接收信息
void decode(void) {

}

int main(void) {
    char op[16];
    if (scanf("%15s", op) != 1) return 0;

    if (strcmp(op, "ENCODE") == 0) {
        encode();
    }
    else if (strcmp(op, "DECODE") == 0) {
        decode();
    }

    return 0;
}
`},{language:"cpp17",label:"C++",code:`#include <bits/stdc++.h>
using namespace std;

using ll = long long;

// 第一次运行：发送信息
void encode() {

}

// 第二次运行：接收信息
void decode() {

}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string op;
    cin >> op;

    if (op == "ENCODE") {
        encode();
    }
    else if (op == "DECODE") {
        decode();
    }

    return 0;
}
`},{language:"python",label:"Python",code:`import sys


# 第一次运行：发送信息
def encode():
    pass


# 第二次运行：接收信息
def decode():
    pass


def main():
    op = sys.stdin.readline().strip()

    if op == "ENCODE":
        encode()
    elif op == "DECODE":
        decode()


if __name__ == "__main__":
    main()
`},{language:"java",label:"Java",code:`import java.util.Scanner;

public class Main {
    static final Scanner in = new Scanner(System.in);

    // 第一次运行：发送信息
    static void encode() {

    }

    // 第二次运行：接收信息
    static void decode() {

    }

    public static void main(String[] args) {
        if (!in.hasNext()) return;
        String op = in.next();

        if (op.equals("ENCODE")) {
            encode();
        }
        else if (op.equals("DECODE")) {
            decode();
        }
    }
}
`}],Pa={key:0,class:"problem-state"},Aa={key:1,class:"problem-state"},Ua={class:"pane problem-pane"},xa={class:"pane-header problem-header"},Va={class:"problem-heading"},Ga={key:0,class:"side-tabs"},za={class:"problem-scroll"},Ba={class:"io-block"},Wa={class:"io-block"},qa={class:"limits"},ja={class:"sample-card"},Fa={class:"sample-label"},Ha={class:"sample-label"},Ka={key:1,class:"submissions-panel"},Ja={key:2,class:"solution-panel"},Xa={class:"solution-levels"},Ya=["innerHTML"],Qa={class:"editor-toolbar"},Za={class:"toolbar-left"},et={class:"toolbar-actions"},lt={class:"editor-area"},at=["aria-valuenow","onKeydown"],tt={class:"debug-actions"},nt={key:3,class:"debug-error"},ut={key:4,class:"debug-metrics"},ot={class:"submission-resources"},st={key:0},it={key:6,class:"debug-fields"},rt=["value"],vt={class:"communication-guide"},dt={class:"communication-introduction"},ct={class:"communication-templates","aria-label":"通信题代码模板"},mt={class:"communication-template-code"},pt=Hl({__name:"PracticeProblemPage",setup(D){const C=Kl(),W=Jl(),ye=Xl(),q=h(()=>String(C.params.problemId??"")),b=h(()=>{const l=q.value.match(/^(?:cp|p)(\d{8})$/);return l?El(l[1]):null}),L=h(()=>C.query.contestId?Number(C.query.contestId):null),O=h(()=>C.query.practiceId?Number(C.query.practiceId):null),Se=h(()=>String(C.query.contestProblemLabel||"").trim()),Ce=u(""),He=u(!1),j=h(()=>L.value!=null),d=u(null),A=u("loading"),Le=u(null),Me=u(""),ue=u(null),Oe=u(!1),_=u("C"),U=u(""),oe=u("light"),ee=u(18),Ne=u(47),Re=u(!1),x=u("statement"),$e=u(!1),Ke=u("c"),kl=["c","cpp17","java","python"].map(l=>hl.find(e=>e.language===l)),V=u(!1),se=u(273);let le=null;function Dl(l){var s;const e=l.currentTarget,o=e.nextElementSibling;le={y:l.clientY,height:o.getBoundingClientRect().height,max:(((s=o.parentElement)==null?void 0:s.clientHeight)??window.innerHeight)*.75},e.setPointerCapture(l.pointerId)}function Tl(l){le&&(se.value=Math.max(120,Math.min(le.max,le.height+le.y-l.clientY)))}function Pe(){le=null}function Je(l){se.value=Math.max(120,se.value+(l.key==="ArrowUp"?20:-20))}const ie=u(""),ae=u(""),_e=u(""),y=u(""),T=u("info"),F=u(null),G=u(!1),I=u(!1),N=u(!1),H=u("PENDING"),Xe=u(0),te=u({time:null,memory:null}),Il=h(()=>{const l=H.value.toUpperCase();return["AC","ACCEPTED"].includes(l)?"#16a34a":["WA","WRONG_ANSWER"].includes(l)?"#dc2626":["TLE","TIME_LIMIT_EXCEEDED"].includes(l)?"#d97706":["MLE","MEMORY_LIMIT_EXCEEDED"].includes(l)?"#9333ea":["RE","RUNTIME_ERROR"].includes(l)?"#ea580c":["CE","COMPILE_ERROR"].includes(l)?"#ca8a04":["NOO","NO_OUTPUT"].includes(l)?"#0891b2":ce(l)?"#2563eb":"#64748b"});function Ye(l){H.value=l.status||"PENDING",te.value={time:l.timeUsed==null?null:Math.floor(Math.min(l.timeUsed,Xe.value+2)),memory:l.memoryUsed==null?null:Math.floor(l.memoryUsed)}}const K=u("custom"),re=u([]),Ae=u(!1),ve=u(""),z=u(null),Ue=u(!1),c=u(null),xe=u(!1),J=u(!1),R=u(""),de=h(()=>{var l;return((l=ye.state.judgeSettings)==null?void 0:l.enabled)!==!1}),Ve=h(()=>{var l;return((l=ye.state.judgeSettings)==null?void 0:l.enableSandbox)!==!1}),we=h(()=>{var l;return((l=d.value)==null?void 0:l.samples)??[]}),Qe=h(()=>typeof K.value=="number"?we.value[K.value]:null),Sl=h(()=>{var l;return((l=P.find(e=>e.label===_.value))==null?void 0:l.monacoLanguage)??"cpp"}),Ge=u(!1),Ze=h(()=>{try{const l=bl("frontend");if(!l)return"guest";const e=l.split(".")[1]??"",o=JSON.parse(window.atob(e.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(e.length/4)*4,"=")));return String(o.userId??o.sub??"guest")}catch{return"guest"}});function el(l){return`qoj.code.user.${Ze.value}.${q.value}.${l}`}function ll(){return`qoj.code.language.user.${Ze.value}.${q.value}`}function Ll(l){var o,s;const e=((o=P.find(S=>S.label===l))==null?void 0:o.templateKey)??"cpp";return((s=ue.value)==null?void 0:s[e])??""}function al(l){return Sa(l)}function Ml(l){try{return window.localStorage.getItem(el(l))}catch{return null}}function tl(){if(d.value)try{window.localStorage.setItem(el(_.value),U.value),window.localStorage.setItem(ll(),_.value)}catch{be.warning("当前浏览器无法保存代码草稿，请及时复制备份")}}function Ol(l){const e=String(l);P.some(o=>o.label===e)&&(_.value=e)}function nl(l){return l.replace(/\r\n/g,`
`).replace(/[ \t]+(?=\n|$)/g,"").replace(/\n+$/,"")}function ze(l){return["AC","ACCEPTED","WA","WRONG_ANSWER","TLE","TIME_LIMIT_EXCEEDED","MLE","MEMORY_LIMIT_EXCEEDED","RE","RUNTIME_ERROR","CE","COMPILE_ERROR","NOO","NO_OUTPUT","SE","SYSTEM_ERROR","FAILED"].includes(String(l||"").toUpperCase().replace(/\s+/g,"_"))}function ce(l){return["WAITING","PENDING","QUEUED","REJUDGE_PENDING","JUDGING","COMPILING","RUNNING"].includes(String(l||"").toUpperCase())}function Nl(l){const e=String(l||"PENDING").trim().toUpperCase().replace(/\s+/g,"_"),o={ACCEPTED:"AC",WRONG_ANSWER:"WA",TIME_LIMIT_EXCEEDED:"TLE",MEMORY_LIMIT_EXCEEDED:"MLE",RUNTIME_ERROR:"RE",COMPILE_ERROR:"CE",NO_OUTPUT:"NOO",SYSTEM_ERROR:"SE",QUEUED:"PENDING"};return La.find(s=>s.code===(o[e]??e))}function me(l){var e;return((e=Nl(l))==null?void 0:e.chinese)??String(l||"PENDING")}function ul(l,e,o){const s=`提交结果：${me(l)}`;return ce(l)||j.value&&He.value?s:`${s} · ${e??0}/${o??0} 通过`}function ol(l){var o;const e=Ml(l);if(e!==null)return e;if((o=d.value)!=null&&o.communication){const s=hl.find(S=>{var E;return S.language===((E=P.find(Y=>Y.label===l))==null?void 0:E.apiValue)});if(s)return s.code}return Ll(l)}let pe=null,X=null,sl=0,he=null,ke=null,fe=null;async function il(){var E,Y;const l=++sl,e=()=>sl===l;if(d.value=null,Ce.value="",A.value="loading",Me.value="",re.value=[],x.value="statement",!b.value){A.value="not-found";return}const o=ye.state.problems.find(f=>f.id===q.value);if(o&&!O.value&&!L.value)d.value=o,A.value="ready";else try{let f;if(L.value)f=await ha(L.value,b.value);else if(O.value){const B=await pa(O.value);Le.value=B.endTime??null;const De=B.problems.find(ne=>ne.id===q.value||Rl(ne.id)===b.value);if(!De)throw new Error("题单题目不存在或已隐藏");f=De}else f=await ka(b.value);if(!e())return;d.value=f,A.value="ready"}catch(f){if(!e())return;Me.value=f instanceof Error?f.message:"题目不存在或无权访问",A.value="not-found";return}const s=(()=>{try{return window.localStorage.getItem(ll())}catch{return null}})(),S=(E=P.find(f=>f.label===s))==null?void 0:E.label;_.value=S??"C";try{const f=await yl(b.value,L.value,1,1),B=al((Y=f[0])==null?void 0:Y.language);!S&&B&&(_.value=B)}catch{}try{if(L.value){const f=await fa(L.value);Ce.value=f.title,He.value=f.status!=="ENDED",Oe.value=f.enableCodeTemplates,f.enableCodeTemplates?ue.value=await gl():ue.value=null}else Oe.value=!0,ue.value=await gl()}catch{Oe.value=!1,ue.value=null}U.value=ol(_.value)}function Rl(l){const e=l.match(/^(?:cp|p)(\d{8})$/);return e?El(e[1]):null}async function Be(){if(b.value){Ae.value=!0,ve.value="";try{re.value=await yl(b.value,L.value,1,50)}catch(l){re.value=[],ve.value=l instanceof Error?l.message:"提交记录加载失败"}finally{Ae.value=!1}}}async function $l(){if(!(!b.value||j.value)){xe.value=!0,R.value="";try{c.value=await Ma(b.value,O.value??void 0)}catch(l){c.value=null,R.value=l instanceof Error?l.message:"题解加载失败"}finally{xe.value=!1}}}async function We(l){if(!(!b.value||!c.value)){J.value=!0,R.value="";try{l==="accept"?c.value=await Oa(b.value,c.value.currentLevel,O.value??void 0):l==="next"?c.value=await Na(b.value,O.value??void 0):c.value=await Ra(b.value,l,O.value??void 0)}catch(e){R.value=e instanceof Error?e.message:"题解操作失败"}finally{J.value=!1}}}function Pl(l){x.value=l}function Al(l){var e;if(l==="custom")K.value="custom",ie.value="";else{const o=Number(l);K.value=o,ie.value=((e=we.value[o])==null?void 0:e.input)??""}ae.value="",y.value="",F.value=null,V.value=!0}function ge(){pe==null||pe(),pe=null,X!=null&&window.clearTimeout(X),X=null}async function rl(l){try{const e=await Cl(l);Ye(e),y.value=ul(e.status,e.passedCaseCount,e.totalCaseCount),T.value=e.status==="AC"||e.status==="ACCEPTED"?"success":ce(e.status)?"info":"error",ze(e.status)&&(Ge.value=!1,I.value=!1,ge(),x.value==="submissions"&&Be())}catch{}}function Ul(l){ge(),Ge.value=!0;let e=!1,o=null;pe=()=>{e=!0,o==null||o(),o=null,X!=null&&window.clearTimeout(X),X=null},ga.subscribeToSubmission(l,E=>{e||(H.value=E.status,y.value=`提交结果：${me(E.status)}`,T.value=ze(E.status)?E.status==="AC"?"success":"error":"info",rl(l))}).then(E=>{e?E():o=E}).catch(()=>{});const S=async()=>{e||(await rl(l),e||(X=window.setTimeout(S,1800)))};S()}async function xl(){if(!(!d.value||!de.value||!Ve.value||G.value||I.value)){V.value=!0,N.value=!1,G.value=!0,ae.value="",_e.value="",y.value="",F.value=null;try{const l=P.find(s=>s.label===_.value),e=await Da({language:(l==null?void 0:l.apiValue)??_.value.toLowerCase(),code:U.value,input:ie.value});ae.value=e.output??"",_e.value=e.error??"",F.value={time:`${e.timeUsed??"-"} ms`,memory:`${e.memoryUsed??"-"} KB`};const o=String(e.status||"").toUpperCase();if(o==="CE"||o==="COMPILE_ERROR")y.value="编译失败",T.value="error";else if(o!=="AC"&&o!=="ACCEPTED")y.value=me(o),T.value="error";else if(d.value.isSpecialJudge)y.value="特殊判题题目，请自行检查调试输出。",T.value="warning";else if(Qe.value){const s=nl(e.output||"")===nl(Qe.value.output||"");y.value=s?"你的测试结果与样例一致":"你的测试结果与样例不一致",T.value=s?"success":"error"}}catch(l){ae.value="",y.value=l instanceof Error?l.message:"调试失败",T.value="error"}finally{G.value=!1}}}async function Vl(){if(!d.value||!b.value||!de.value||G.value||I.value)return;if(!bl("frontend")){W.push(`/login?redirect=${encodeURIComponent(C.fullPath)}`);return}I.value=!0,N.value=!0,H.value="PENDING",te.value={time:null,memory:null},Xe.value=d.value.timeLimit*(["C","C++17","C++20","C++23"].includes(_.value)?1:2),Ge.value=!1,V.value=!0,y.value="正在发送到后端判题队列…",T.value="info";const l=P.find(e=>e.label===_.value);try{ge();const e=await Ta({problemId:b.value,practiceId:O.value??void 0,contestId:L.value??void 0,language:(l==null?void 0:l.apiValue)??_.value.toLowerCase(),code:U.value});Ye(e),y.value=ul(e.status,e.passedCaseCount,e.totalCaseCount),T.value=e.status==="AC"||e.status==="ACCEPTED"?"success":ce(e.status)?"info":"error",e.id&&!ze(e.status)?Ul(e.id):(I.value=!1,x.value==="submissions"&&Be())}catch(e){H.value="FAILED",y.value=e instanceof Error?e.message:"提交失败，请检查后端服务。",T.value="error",I.value=!1}}async function vl(l){await _l(l)?be.success("已复制到剪贴板"):be.error("复制失败，请手动选择内容复制")}async function Gl(l){Ue.value=!0;try{z.value=l.code?l:await Cl(l.id)}catch(e){be.error(e instanceof Error?e.message:"提交代码加载失败")}finally{Ue.value=!1}}function zl(l){l.preventDefault(),Re.value=!0;const e=s=>{Ne.value=Math.max(18,Math.min(82,s.clientX/window.innerWidth*100))},o=()=>{Re.value=!1,window.removeEventListener("mousemove",e),window.removeEventListener("mouseup",o),he=null,ke=null};he=e,ke=o,window.addEventListener("mousemove",e),window.addEventListener("mouseup",o)}function ft(l){return l}function Bl(){W.push(`/practice/history/${q.value}`)}return Ee(_,l=>{U.value=ol(l),tl()}),Ee(U,tl),Ee([q,L,O],()=>{ge(),c.value=null,Le.value=null,il()}),Ee(x,l=>{l==="submissions"&&Be(),l==="solution"&&$l()}),Ee(Le,l=>{if(fe!=null&&window.clearTimeout(fe),!l)return;const e=new Date(l).getTime()-Date.now();if(e<=0){d.value=null,A.value="not-found";return}fe=window.setTimeout(()=>{d.value=null,A.value="not-found"},e)}),Yl(()=>{ye.hydrate(),il()}),Ql(()=>{ge(),fe!=null&&window.clearTimeout(fe),he&&window.removeEventListener("mousemove",he),ke&&window.removeEventListener("mouseup",ke)}),Zl(h(()=>d.value?`${j.value?`${Se.value||b.value} - `:""}${d.value.title}${Ce.value?` - ${Ce.value}`:""}`:null)),(l,e)=>{const o=ea,s=aa,S=la,E=ta,Y=Ca,f=ba,B=ua,De=ya,ne=ia,dl=sa,Wl=ra,ql=wa,jl=_a,cl=ca;return n(),g(ma,null,{default:v(()=>{var ml;return[A.value==="loading"?(n(),m("div",Pa,[i(o,{class:"is-loading"},{default:v(()=>[...e[16]||(e[16]=[t("span",{class:"loader-dot"},"◌",-1)])]),_:1}),e[17]||(e[17]=p("加载题目中…",-1))])):d.value?(n(),m("main",{key:2,class:pl(["practice-workspace",{resizing:Re.value}]),style:qe({gridTemplateColumns:`${Ne.value}fr 6px ${100-Ne.value}fr`})},[t("section",Ua,[t("header",xa,[t("div",Va,[i(E,{type:"primary"},{default:v(()=>[p(r(j.value?"比赛题目":"题目"),1)]),_:1}),t("h1",null,r(Se.value?`${Se.value} - `:"")+r(d.value.title),1),d.value.communication?(n(),m(M,{key:0},[i(E,{type:"warning"},{default:v(()=>[...e[19]||(e[19]=[p("通信题 · 两阶段",-1)])]),_:1}),i(s,{link:"",type:"primary",onClick:e[1]||(e[1]=a=>$e.value=!0)},{default:v(()=>[...e[20]||(e[20]=[p("通信题教程",-1)])]),_:1})],64)):d.value.isSpecialJudge?(n(),g(E,{key:1},{default:v(()=>[...e[21]||(e[21]=[p("Special Judge",-1)])]),_:1})):w("",!0)])]),j.value?w("",!0):(n(),m("nav",Ga,[(n(),m(M,null,Q([{id:"statement",name:"题目描述"},{id:"submissions",name:"我的提交"},{id:"solution",name:"题解"}],a=>i(s,{text:"",key:a.id,type:x.value===a.id?"primary":void 0,onClick:k=>Pl(a.id)},{default:v(()=>[p(r(a.name),1)]),_:2},1032,["type","onClick"])),64))])),t("div",za,[j.value||x.value==="statement"?na([d.value],()=>(n(),m("article",{key:0,class:"statement-content"},[t("section",null,[e[22]||(e[22]=t("h2",null,"题目描述",-1)),i(Z,{value:d.value.statement||d.value.summary,"class-name":"problem-rich-text"},null,8,["value"])]),t("section",null,[e[23]||(e[23]=t("h2",null,"输入描述",-1)),t("div",Ba,[i(Z,{value:d.value.inputFormat||"输入数据。"},null,8,["value"])])]),t("section",null,[e[24]||(e[24]=t("h2",null,"输出描述",-1)),t("div",Wa,[i(Z,{value:d.value.outputFormat||"输出答案。"},null,8,["value"])])]),t("fieldset",qa,[e[27]||(e[27]=t("legend",null,"评测信息",-1)),t("div",null,[e[25]||(e[25]=t("span",null,"C/C++",-1)),t("span",null,"时间限制："+r(d.value.timeLimit/1e3)+" 秒",1),t("span",null,"内存限制："+r(d.value.memoryLimit)+" MB",1)]),t("div",null,[e[26]||(e[26]=t("span",null,"其他语言",-1)),t("span",null,"时间限制："+r(d.value.timeLimit/500)+" 秒",1),t("span",null,"内存限制："+r(d.value.memoryLimit*2)+" MB",1)])]),(n(!0),m(M,null,Q(we.value,(a,k)=>(n(),m("section",{key:`${a.caseNo}-${k}`,class:"sample-block"},[t("h2",null,"示例 "+r(k+1),1),t("div",ja,[t("div",Fa,[e[29]||(e[29]=p("输入 ",-1)),i(s,{link:"",onClick:Te=>vl(a.input)},{default:v(()=>[...e[28]||(e[28]=[p("复制",-1)])]),_:1},8,["onClick"])]),i(Z,{value:a.input,"class-name":"sample-value","preserve-plain-text-whitespace":!0},null,8,["value"]),t("div",Ha,[e[31]||(e[31]=p("输出 ",-1)),i(s,{link:"",onClick:Te=>vl(a.output)},{default:v(()=>[...e[30]||(e[30]=[p("复制",-1)])]),_:1},8,["onClick"])]),i(Z,{value:a.output,"class-name":"sample-value","preserve-plain-text-whitespace":!0},null,8,["value"]),a.explanation?(n(),m(M,{key:0},[e[32]||(e[32]=t("div",{class:"sample-label"},"解释",-1)),i(Z,{value:a.explanation,"class-name":"sample-value"},null,8,["value"])],64)):w("",!0)])]))),128))])),e,2):x.value==="submissions"?(n(),m("section",Ka,[Ae.value?(n(),g(Y,{key:0,rows:5,animated:""})):ve.value?(n(),g(f,{key:1,type:"warning",title:ve.value.includes("登录")?"登录后可以查看自己的提交记录。":ve.value,closable:!1},null,8,["title"])):re.value.length?(n(!0),m(M,{key:3},Q(re.value,a=>(n(),m("article",{key:a.id,class:"submission-row"},[t("div",null,[i(E,{type:a.status==="AC"||a.status==="ACCEPTED"?"success":ce(a.status)?"warning":"danger"},{default:v(()=>[p(r(me(a.status)),1)]),_:2},1032,["type"]),t("p",null,r($(Ia)(a.language))+" · "+r(a.submitTime||a.createdAt),1)]),t("span",null,r(a.passedCaseCount??0)+"/"+r(a.totalCaseCount??0)+" 通过",1),i(s,{size:"small",loading:Ue.value,onClick:k=>Gl(a)},{default:v(()=>[...e[33]||(e[33]=[p("查看代码",-1)])]),_:1},8,["loading","onClick"])]))),128)):(n(),g(B,{key:2,description:"还没有提交记录"}))])):(n(),m("section",Ja,[xe.value?(n(),g(Y,{key:0,rows:5,animated:""})):R.value&&!c.value?(n(),g(f,{key:1,type:"warning",title:R.value.includes("登录")?"登录后可以逐层查看题解。":R.value,closable:!1},null,8,["title"])):!c.value||c.value.height===0?(n(),g(B,{key:2,description:"这道题还没有发布题解"})):(n(),m(M,{key:3},[e[35]||(e[35]=t("header",null,[t("h2",null,"渐进题解"),t("p",null,"从第一层提示开始，没想通就点“下一关”。开启下一层后，之前的层级只能回看。")],-1)),t("div",Xa,[(n(!0),m(M,null,Q(c.value.height,a=>(n(),g(s,{key:a,type:a===c.value.currentLevel?"primary":c.value.acceptedLevel===a?"success":"",disabled:J.value||a>c.value.maxViewedLevel||a===c.value.currentLevel,onClick:k=>We(a)},{default:v(()=>[p("第 "+r(a)+" 层 · "+r(c.value.levelAcceptedCounts[a-1]??0)+" 人 AC",1)]),_:2},1032,["type","disabled","onClick"]))),128))]),i(De,{shadow:"never"},{default:v(()=>[t("h3",null,"第 "+r(c.value.currentLevel)+" 层 / 共 "+r(c.value.height)+" 层",1),t("p",null,"已有 "+r(c.value.acceptedCount)+" 人在本层 AC",1),t("div",{class:"announcement-html markdown-math",innerHTML:$(oa)(c.value.content)},null,8,Ya),i(s,{type:"success",disabled:J.value||c.value.acceptedLevel!=null||c.value.currentLevel<c.value.maxViewedLevel,loading:J.value,onClick:e[3]||(e[3]=a=>We("accept"))},{default:v(()=>[p(r(c.value.acceptedLevel!=null?`已在第 ${c.value.acceptedLevel} 层 AC`:"本关 AC"),1)]),_:1},8,["disabled","loading"]),i(s,{disabled:J.value||c.value.currentLevel>=c.value.height,loading:J.value,onClick:e[4]||(e[4]=a=>We("next"))},{default:v(()=>[...e[34]||(e[34]=[p("下一关",-1)])]),_:1},8,["disabled","loading"]),R.value?(n(),g(f,{key:0,type:"error",title:R.value,closable:!1},null,8,["title"])):w("",!0)]),_:1})],64))]))])]),t("div",{class:"resize-divider",role:"separator","aria-label":"拖动调整题面和代码区域比例",onMousedown:zl},null,32),t("section",{class:pl(["pane editor-pane",oe.value])},[t("header",Qa,[t("div",Za,[i(dl,{"model-value":_.value,"aria-label":"选择提交语言",onChange:Ol},{default:v(()=>[(n(!0),m(M,null,Q($(P),a=>(n(),g(ne,{key:a.label,label:a.label,value:a.label},null,8,["label","value"]))),128))]),_:1},8,["model-value"]),i(s,{circle:"","aria-label":"减小字体",onClick:e[5]||(e[5]=a=>ee.value=Math.max(12,ee.value-1))},{default:v(()=>[...e[36]||(e[36]=[p("−",-1)])]),_:1}),t("span",null,r(ee.value)+"px",1),i(s,{circle:"","aria-label":"增大字体",onClick:e[6]||(e[6]=a=>ee.value=Math.min(28,ee.value+1))},{default:v(()=>[...e[37]||(e[37]=[p("+",-1)])]),_:1}),i(Wl,{modelValue:oe.value,"onUpdate:modelValue":e[7]||(e[7]=a=>oe.value=a),"active-value":"dark","inactive-value":"light","active-text":"黑色背景","aria-label":"代码编辑器黑色背景"},null,8,["modelValue"])]),t("div",et,[j.value?w("",!0):(n(),g(s,{key:0,onClick:Bl},{default:v(()=>[...e[38]||(e[38]=[p("历史提交",-1)])]),_:1})),i(s,{class:"editor-action",round:"",disabled:G.value||I.value,onClick:e[8]||(e[8]=a=>{N.value=!1,V.value=!V.value})},{default:v(()=>[...e[39]||(e[39]=[p("调试",-1)])]),_:1},8,["disabled"]),i(s,{class:"editor-action",round:"",type:"success",loading:I.value,disabled:!de.value||G.value||I.value,onClick:Vl},{default:v(()=>[p(r(I.value?"提交中":"提交"),1)]),_:1},8,["loading","disabled"])])]),t("div",lt,[i(wl,{modelValue:U.value,"onUpdate:modelValue":e[9]||(e[9]=a=>U.value=a),language:Sl.value,theme:oe.value,"font-size":ee.value},null,8,["modelValue","language","theme","font-size"])]),V.value?(n(),m("div",{key:0,class:"debug-resize-handle",role:"separator","aria-label":"上下调整调试面板高度","aria-orientation":"horizontal",tabindex:"0","aria-valuenow":Math.round(se.value),"aria-valuemin":"120",onPointerdown:je(Dl,["prevent"]),onPointermove:Tl,onPointerup:Pe,onPointercancel:Pe,onLostpointercapture:Pe,onKeydown:[fl(je(Je,["prevent"]),["up"]),fl(je(Je,["prevent"]),["down"])]},null,40,at)):w("",!0),V.value?(n(),m("section",{key:1,class:"debug-panel",style:qe({height:`${se.value}px`})},[t("header",null,[t("strong",null,r(N.value?"提交结果":"调试面板"),1),t("div",tt,[N.value?w("",!0):(n(),g(dl,{key:0,"model-value":K.value==="custom"?"custom":String(K.value),disabled:!!d.value.communication,onChange:Al},{default:v(()=>[i(ne,{label:"自定义输入",value:"custom"}),(n(!0),m(M,null,Q(we.value,(a,k)=>(n(),g(ne,{key:k,label:`样例 ${k+1}`,value:String(k)},null,8,["label","value"]))),128))]),_:1},8,["model-value","disabled"])),i(s,{type:"primary",loading:G.value,disabled:I.value||!de.value||!Ve.value,onClick:xl},{default:v(()=>[p(r(G.value?"调试中":"运行调试"),1)]),_:1},8,["loading","disabled"]),i(s,{type:"danger",round:"",onClick:e[10]||(e[10]=a=>V.value=!1)},{default:v(()=>[...e[40]||(e[40]=[p("取消",-1)])]),_:1})])]),de.value?Ve.value?w("",!0):(n(),g(f,{key:1,type:"warning",title:"管理员已关闭代码调试功能。",closable:!1})):(n(),g(f,{key:0,type:"warning",title:"判题服务已关闭，无法提交或运行代码。",closable:!1})),y.value&&!N.value?(n(),g(f,{key:2,type:T.value,title:y.value,closable:!1},null,8,["type","title"])):w("",!0),_e.value&&!N.value?(n(),m("pre",nt,r(_e.value),1)):w("",!0),F.value&&!N.value?(n(),m("div",ut,"运行时间："+r(F.value.time)+" · 运行内存："+r(F.value.memory),1)):w("",!0),N.value?(n(),m("div",{key:5,class:"submission-result",role:"status","aria-live":"polite",style:qe({color:Il.value})},[t("strong",null,r(me(H.value)),1),t("div",ot,[t("span",null,"耗时："+r(te.value.time==null?"—":`${te.value.time} ms`),1),t("span",null,"内存："+r(te.value.memory==null?"—":`${te.value.memory} KB`),1)]),H.value==="FAILED"?(n(),m("p",st,r(y.value),1)):w("",!0)],4)):(n(),m("div",it,[t("label",null,[e[41]||(e[41]=p("输入",-1)),va(t("textarea",{"onUpdate:modelValue":e[11]||(e[11]=a=>ie.value=a),"aria-label":"调试输入",placeholder:"在这里输入自定义数据，支持换行",spellcheck:"false",onInput:e[12]||(e[12]=a=>{K.value="custom",ae.value="",y.value="",F.value=null})},null,544),[[da,ie.value]])]),t("label",null,[e[42]||(e[42]=p("输出",-1)),t("textarea",{value:ae.value,"aria-label":"调试输出",readonly:"",spellcheck:"false"},null,8,rt)])]))],4)):w("",!0)],2)],6)):(n(),m("div",Aa,[i(S,{icon:"error",title:"题目不存在","sub-title":Me.value||"该题目不存在、已被隐藏，或你没有访问权限。"},{extra:v(()=>[i(s,{type:"primary",onClick:e[0]||(e[0]=a=>$(W).push("/problems"))},{default:v(()=>[...e[18]||(e[18]=[p("返回题库",-1)])]),_:1})]),_:1},8,["sub-title"])])),i(cl,{modelValue:$e.value,"onUpdate:modelValue":e[14]||(e[14]=a=>$e.value=a),title:"通信题教程",width:"min(1120px, 94vw)","align-center":""},{default:v(()=>[t("div",vt,[t("section",dt,[i(Z,{value:$($a)},null,8,["value"])]),t("section",ct,[i(jl,{modelValue:Ke.value,"onUpdate:modelValue":e[13]||(e[13]=a=>Ke.value=a)},{default:v(()=>[(n(!0),m(M,null,Q($(kl),a=>(n(),g(ql,{key:a.language,label:a.label,name:a.language},{default:v(()=>[i(s,{onClick:k=>$(_l)(a.code).then(()=>$(be).success("模板已复制"))},{default:v(()=>[p("复制 "+r(a.label)+" 模板",1)]),_:2},1032,["onClick"]),t("pre",mt,[t("code",null,r(a.code),1)])]),_:2},1032,["label","name"]))),128))]),_:1},8,["modelValue"])])])]),_:1},8,["modelValue"]),i(cl,{"model-value":!!z.value,title:`提交代码 #${((ml=z.value)==null?void 0:ml.id)??""}`,width:"min(900px, 92vw)",onClose:e[15]||(e[15]=a=>z.value=null)},{default:v(()=>{var a;return[z.value?(n(),g(wl,{key:z.value.id,"model-value":z.value.code||"",language:((a=$(P).find(k=>{var Te;return k.label===al((Te=z.value)==null?void 0:Te.language)}))==null?void 0:a.monacoLanguage)||"cpp","read-only":"",theme:oe.value},null,8,["model-value","language","theme"])):w("",!0)]}),_:1},8,["model-value","title"])]}),_:1})}}}),St=Ea(pt,[["__scopeId","data-v-a639e1ec"]]);export{St as default};
