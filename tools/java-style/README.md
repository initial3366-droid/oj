# Agent Java formatting

Reference: [Alibaba Java Coding Guidelines](https://github.com/alibaba/p3c), Huangshan edition.

`eclipse-codestyle.xml` originates from the Apache-2.0 licensed
[Alibaba P3C formatter profile](https://github.com/alibaba/p3c/blob/master/p3c-formatter/eclipse-codestyle.xml).
The profile uses four spaces, a 120-character margin and four-space continuation indentation.
The Maven wrapper configuration targets Java 17 and LF/UTF-8 in both agent service packages:

- `backend/src/main/java/com/qoj/module/agent/service`
- `agent-java/src/main/java/com/qojagent/service`

From the repository root:

```sh
mvn -f tools/java-style/pom.xml formatter:format
mvn -f tools/java-style/pom.xml formatter:validate
```

Formatting does not insert control-statement braces or improve naming automatically.
Follow the Java code style section in `AGENTS.md` when editing logic. Preserve literal
strings and text blocks: a formatter cannot safely split all long literals, URLs or regular expressions.
The 120-character margin applies to wrappable code; document unavoidable long literals.

The initial style pass is checked against saved pre-change syntax trees, normalizing only
single-statement control-body braces and ignoring comments/whitespace. This confirms the
mechanical formatting pass preserves the parsed program; existing Maven tests cover runtime rules.
