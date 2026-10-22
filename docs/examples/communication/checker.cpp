#include "testlib.h"
int main(int argc, char** argv) {
    registerTestlibCmd(argc, argv);
    long long actual = ouf.readLong(), expected = ans.readLong();
    if (!ouf.seekEof()) quitf(_wa, "extra output");
    if (actual != expected) quitf(_wa, "wrong sum");
    quitf(_ok, "correct");
}
