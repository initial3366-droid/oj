import sys
parts = sys.stdin.read().split()
if parts[0] == 'ENCODE':
    print(int(parts[1]))
elif parts[0] == 'DECODE':
    print(int(parts[1]) + int(parts[2]))
