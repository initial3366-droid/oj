#include <stdio.h>
#include <string.h>
int main(void) {
    char phase[16]; long long a, b;
    if (scanf("%15s", phase) != 1) return 1;
    if (!strcmp(phase, "ENCODE")) { scanf("%lld", &a); printf("%lld\n", a); }
    else if (!strcmp(phase, "DECODE")) { scanf("%lld%lld", &a, &b); printf("%lld\n", a+b); }
    return 0;
}
