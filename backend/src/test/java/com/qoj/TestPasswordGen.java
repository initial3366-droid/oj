package com.qoj;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestPasswordGen {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        System.out.println("admin123: " + encoder.encode("admin123"));
        System.out.println("password: " + encoder.encode("password"));
    }
}
