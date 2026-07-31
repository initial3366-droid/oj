package com.qoj.module.user.service;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.ClientConfig;
import com.qcloud.cos.auth.BasicCOSCredentials;
import com.qcloud.cos.auth.COSCredentials;
import com.qcloud.cos.region.Region;
import org.springframework.stereotype.Component;

@Component
public class TencentCosClientFactory {
    public COSClient create(String secretId, String secretKey, String regionName) {
        COSCredentials credentials = new BasicCOSCredentials(secretId, secretKey);
        return new COSClient(credentials, new ClientConfig(new Region(regionName)));
    }
}
