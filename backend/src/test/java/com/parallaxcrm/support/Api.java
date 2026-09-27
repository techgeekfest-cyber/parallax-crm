package com.parallaxcrm.support;

import com.parallaxcrm.identity.AuthenticatedUser;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static com.parallaxcrm.support.TestUsers.as;

/** Terse, authenticated HTTP calls for API tests. Every call goes through the real filter chain and controllers. */
public class Api {

    private final MockMvcTester mvc;
    private final JsonMapper json;

    Api(MockMvcTester mvc, JsonMapper json) {
        this.mvc = mvc;
        this.json = json;
    }

    public MvcTestResult get(AuthenticatedUser actor, String uri, Object... vars) {
        return mvc.get().with(as(actor)).uri(uri, vars).exchange();
    }

    public MvcTestResult post(AuthenticatedUser actor, String uri, Object body, Object... vars) {
        return mvc.post().with(as(actor)).uri(uri, vars).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body == null ? Map.of() : body)).exchange();
    }

    public MvcTestResult put(AuthenticatedUser actor, String uri, Object body, Object... vars) {
        return mvc.put().with(as(actor)).uri(uri, vars).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)).exchange();
    }

    public JsonNode body(MvcTestResult result) {
        return json.readTree(result.getResponse().getContentAsByteArray());
    }

    /** POSTs and returns the created resource's id, failing loudly if creation didn't succeed. */
    public String create(AuthenticatedUser actor, String uri, Object body) {
        MvcTestResult result = post(actor, uri, body);
        if (result.getResponse().getStatus() != 201) {
            throw new AssertionError("Expected 201 from POST " + uri + " but got " + result.getResponse().getStatus()
                    + ": " + new String(result.getResponse().getContentAsByteArray()));
        }
        return body(result).get("id").asString();
    }
}
