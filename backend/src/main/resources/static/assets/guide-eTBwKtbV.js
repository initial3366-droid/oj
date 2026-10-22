async function p(t){var r;if(typeof window>"u"||typeof document>"u")return!1;if(window.isSecureContext&&((r=navigator.clipboard)!=null&&r.writeText))try{return await navigator.clipboard.writeText(t),!0}catch{return!1}if(!document.body||typeof document.execCommand!="function")return!1;const n=document.createElement("textarea");n.value=t,n.setAttribute("readonly",""),n.style.position="fixed",n.style.top="0",n.style.left="-9999px",n.style.width="1px",n.style.height="1px",n.style.padding="0",n.style.border="0",n.style.opacity="0",n.style.pointerEvents="none",document.body.appendChild(n);const a=document.activeElement,e=document.getSelection(),l=e?Array.from({length:e.rangeCount},(i,d)=>e.getRangeAt(d).cloneRange()):[];let c=!1;const s=i=>{c=!0,i.clipboardData&&(i.preventDefault(),i.clipboardData.setData("text/plain",t))};let o=!1;document.addEventListener("copy",s);try{n.focus(),n.select(),n.setSelectionRange(0,n.value.length),o=document.execCommand("copy")}catch{o=!1}finally{document.removeEventListener("copy",s),n.remove(),e&&(e.removeAllRanges(),l.forEach(i=>e.addRange(i))),a&&a!==document.body&&a.focus({preventScroll:!0})}return o&&c}const u={c:{source:"main.c",compile:"/usr/bin/gcc -std=c11 -O2 -pipe main.c -o main",run:"./main",note:"使用 C11。整数示例使用 long long 和 %lld；scanf 返回成功读取的数量，可用于判断输入是否结束。"},cpp17:{source:"main.cpp",compile:"/usr/bin/g++ -std=c++17 -O2 -pipe main.cpp -o main",run:"./main",note:"使用 C++17。关闭 iostream 与 C 标准流的同步后，建议统一使用 cin / cout 进行输入输出。"},cpp20:{source:"main.cpp",compile:"/usr/bin/g++ -std=c++20 -O2 -pipe main.cpp -o main",run:"./main",note:"使用 C++20。下面的基础输入输出示例与 C++17 通用；提交时仍需选择对应的语言标准。"},cpp23:{source:"main.cpp",compile:"/usr/bin/g++ -std=c++23 -O2 -pipe main.cpp -o main",run:"./main",note:"使用 C++23。下面的基础输入输出示例与 C++17 通用；新标准特性的可用性取决于判题环境中的编译器。"},python:{source:"main.py",compile:"/usr/bin/python3 -m py_compile main.py",run:"/usr/bin/python3 main.py",note:"使用 Python 3。提交后先检查语法，再运行源码。read().split() 按空白拆分输入，不要求每组数据独占一行；一次读入会占用额外内存。"},java:{source:"Main.java",compile:"/usr/local/bin/qoj-java-compile",compileDetails:`/usr/bin/javac -encoding UTF-8 Main.java
exec /usr/bin/jar --create --file main.jar ./*.class`,run:"/usr/bin/java -Xms16m -Xmx<H>m -XX:+UseSerialGC -cp main.jar Main",note:"公开类必须命名为 Main，不写 package。平台编译后将所有 class 文件打包。运行参数 H = max(16, 题目内存限制 MB − 32)。示例使用 Scanner 方便理解；大量输入可改用缓冲输入。"}},g=[{key:"single",label:"单组 A+B",description:"输入两个整数 A、B，输出 A+B。只处理一组数据，不读取组数。",input:"1 2",output:"3"},{key:"count",label:"多组：首行 T",description:"第一个整数 T 表示组数，随后读取恰好 T 组 A、B，每组输出一行。不要把 T 当成 A。",input:`3
1 2
-5 8
0 0`,output:`3
3
0`},{key:"eof",label:"多组：读到 EOF",description:"输入没有组数。每次成功读取一对 A、B 就计算一次，直到文件结束（EOF）；不能把第一对整数当成组数。",input:`1 2
-5 8
0 0`,output:`3
3
0`}],m={c:{single:String.raw`#include <stdio.h>

int main(void) {
    long long a, b;
    if (scanf("%lld %lld", &a, &b) == 2) {
        printf("%lld\n", a + b);
    }
    return 0;
}`,count:String.raw`#include <stdio.h>

int main(void) {
    int t;
    scanf("%d", &t);
    while (t--) {
        long long a, b;
        scanf("%lld %lld", &a, &b);
        printf("%lld\n", a + b);
    }
    return 0;
}`,eof:String.raw`#include <stdio.h>

int main(void) {
    long long a, b;
    while (scanf("%lld %lld", &a, &b) == 2) {
        printf("%lld\n", a + b);
    }
    return 0;
}`},cpp:{single:String.raw`#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    if (cin >> a >> b) {
        cout << a + b << '\n';
    }
    return 0;
}`,count:String.raw`#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int t;
    cin >> t;
    while (t--) {
        long long a, b;
        cin >> a >> b;
        cout << a + b << '\n';
    }
    return 0;
}`,eof:String.raw`#include <iostream>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    while (cin >> a >> b) {
        cout << a + b << '\n';
    }
    return 0;
}`},python:{single:String.raw`import sys

a, b = map(int, sys.stdin.buffer.read().split())
print(a + b)`,count:String.raw`import sys

data = iter(map(int, sys.stdin.buffer.read().split()))
t = next(data)
answers = []
while t > 0:
    a, b = next(data), next(data)
    answers.append(str(a + b))
    t -= 1
sys.stdout.write("\n".join(answers))`,eof:String.raw`import sys

data = iter(map(int, sys.stdin.buffer.read().split()))
answers = []
for a, b in zip(data, data):
    answers.append(str(a + b))
sys.stdout.write("\n".join(answers))`},java:{single:String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        long a = in.nextLong();
        long b = in.nextLong();
        System.out.println(a + b);
    }
}`,count:String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int t = in.nextInt();
        StringBuilder out = new StringBuilder();
        while (t-- > 0) {
            long a = in.nextLong();
            long b = in.nextLong();
            out.append(a + b).append('\n');
        }
        System.out.print(out);
    }
}`,eof:String.raw`import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        StringBuilder out = new StringBuilder();
        while (in.hasNextLong()) {
            long a = in.nextLong();
            long b = in.nextLong();
            out.append(a + b).append('\n');
        }
        System.out.print(out);
    }
}`}},b=[{code:"AC",english:"Accepted",chinese:"提交通过",tone:"success",description:"程序通过本次评测的全部测试点，输出满足题目的判定规则，时间和内存均符合限制。",advice:"通过样例只是自测；提交结果为 AC 才表示通过正式测试。"},{code:"WA",english:"Wrong Answer",chinese:"答案错误",tone:"danger",description:"程序运行结束，但至少一个测试点的输出未通过判定。",advice:"检查算法、边界、整数溢出和输出内容；不要输出“请输入”等提示语。特殊判题按题目规则检查答案。"},{code:"TLE",english:"Time Limit Exceeded",chinese:"运行超时",tone:"warning",description:"某个测试点的运行时间超过题目限制。",advice:"检查时间复杂度、死循环和输入结束条件，减少重复计算，必要时优化输入输出。"},{code:"MLE",english:"Memory Limit Exceeded",chinese:"内存超限",tone:"warning",description:"程序使用的内存超过题目限制。",advice:"检查大数组、递归深度和未释放的数据；尝试滚动数组或减少同时保存的数据。"},{code:"RE",english:"Runtime Error",chinese:"运行错误",tone:"danger",description:"程序运行时异常退出、返回非零退出码，或触发沙箱运行限制；输出过量也可能归入此状态。",advice:"检查数组越界、除零、栈溢出、Java / Python 异常及错误日志。"},{code:"CE",english:"Compile Error",chinese:"编译错误",tone:"danger",description:"源码没有通过编译或语法检查，尚未运行测试点。",advice:"查看编译信息，检查语法、所选语言标准，以及 Java 的 Main 类名和 package 声明。"},{code:"NOO",english:"No Output",chinese:"无输出",tone:"warning",description:"结果显示程序没有产生所需的标准输出；空输出也可能根据判定方式显示为 WA。",advice:"检查是否执行了输出语句、是否误写到文件或标准错误流，以及是否提前返回。"},{code:"SE",english:"System Error",chinese:"系统错误",tone:"neutral",description:"评测服务、环境或判题流程异常，无法完成正常判定。",advice:"查看错误信息，稍后重试或联系管理员；该状态不能说明算法是否正确。"},{code:"FAILED",english:"Failed",chinese:"评测任务失败",tone:"neutral",description:"队列任务未能正常完成评测，未得到可用的最终判题结果。",advice:"查看任务错误信息；持续出现时联系管理员处理，等待恢复或重新评测。"},{code:"WAITING",english:"Waiting",chinese:"等待入队",tone:"info",description:"提交已被接收，正在等待进入判题流程。",advice:"无需重复提交，等待状态更新。"},{code:"PENDING",english:"Pending",chinese:"等待评测",tone:"info",description:"提交在判题队列中，等待可用的评测资源。",advice:"高峰期可能需要排队；此状态不是答案错误。"},{code:"COMPILING",english:"Compiling",chinese:"编译中",tone:"info",description:"正在编译源码，或对 Python 源码进行语法检查。",advice:"等待编译完成后，程序才会进入运行与判定阶段。"},{code:"RUNNING",english:"Running",chinese:"运行中",tone:"info",description:"程序正在测试数据上运行。",advice:"此时尚未得到全部测试点的最终结果。"},{code:"JUDGING",english:"Judging",chinese:"评测中",tone:"info",description:"系统正在执行测试并检查输出，尚未完成最终判定。",advice:"等待 AC、WA 等最终状态；通过部分测试点不代表整题通过。"},{code:"REJUDGE_PENDING",english:"Rejudge Pending",chinese:"等待重判",tone:"info",description:"提交已安排重新评测，正在等待调度。",advice:"重判可能更新原有结果，以重判完成后的最终状态为准。"}];export{m as E,g as I,u as L,b as V,p as c};
