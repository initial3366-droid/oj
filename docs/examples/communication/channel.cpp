#include <fstream>
#include <iostream>
#include <string>
// argv: original input, sender message, expected answer, receiver public input.
// Only approved message and public input cross into the receiver sandbox.
int main(int argc, char** argv) {
    if (argc != 5) return 3;
    std::ifstream message(argv[2]), publicData(argv[4]);
    long long value, addend;
    if (!(message >> value)) return 1;
    std::string extra;
    if (message >> extra) return 1;
    if (!(publicData >> addend)) return 3;
    std::cout << "DECODE\n" << value << ' ' << addend << '\n';
    return 0;
}
