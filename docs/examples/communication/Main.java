import java.util.Scanner;
public class Main {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        String phase = in.next();
        if (phase.equals("ENCODE")) System.out.println(in.nextLong());
        else if (phase.equals("DECODE")) System.out.println(in.nextLong() + in.nextLong());
    }
}
