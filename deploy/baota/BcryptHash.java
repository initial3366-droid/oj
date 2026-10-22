import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class BcryptHash {
    public static void main(String[] args) throws Exception {
        String password = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8)).readLine();
        if (password == null || password.length() < 12 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Invalid password length");
        }
        System.out.println(new BCryptPasswordEncoder(12).encode(password));
    }
}
