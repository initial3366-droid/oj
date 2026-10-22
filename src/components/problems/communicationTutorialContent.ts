export const COMMUNICATION_TUTORIAL_HTML = `
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
`;

export const COMMUNICATION_TEMPLATES = [
  { language: 'c', label: 'C', code: `#include <stdio.h>
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
` },
  { language: 'cpp17', label: 'C++', code: `#include <bits/stdc++.h>
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
` },
  { language: 'python', label: 'Python', code: `import sys


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
` },
  { language: 'java', label: 'Java', code: `import java.util.Scanner;

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
` },
] as const;
