#include <iostream>
#include <string>
using namespace std;
int main() {
    string phase;
    cin >> phase;
    if (phase == "ENCODE") {
        long long secret; cin >> secret;
        cout << secret << '\n';
    } else if (phase == "DECODE") {
        long long secret, addend; cin >> secret >> addend;
        cout << secret + addend << '\n';
    }
}
