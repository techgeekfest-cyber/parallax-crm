package com.parallaxcrm.shared.web;

import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverter;
import io.swagger.v3.core.converter.ModelConverterContext;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.media.Schema;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

import java.lang.reflect.RecordComponent;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

/**
 * Marks every property of a {@code *Response} record as required in the OpenAPI document unless the record component
 * is annotated with JSpecify {@link Nullable}. The Java types stay the single source of truth for nullability, and
 * the generated TypeScript types only make genuinely optional fields optional.
 */
@Component
class RequiredResponsePropertiesConverter implements ModelConverter {

    @Override
    public Schema<?> resolve(AnnotatedType type, ModelConverterContext context, Iterator<ModelConverter> chain) {
        Schema<?> resolved = chain.hasNext() ? chain.next().resolve(type, context, chain) : null;
        if (resolved == null) {
            return null;
        }
        Class<?> rawClass = Json.mapper().constructType(type.getType()).getRawClass();
        if (rawClass.isRecord() && rawClass.getSimpleName().endsWith("Response")) {
            Schema<?> model = resolved.get$ref() == null
                    ? resolved
                    : context.getDefinedModels().get(resolved.get$ref().substring(resolved.get$ref().lastIndexOf('/') + 1));
            if (model != null && model.getProperties() != null) {
                List<String> required = Arrays.stream(rawClass.getRecordComponents())
                        .filter(component -> !isNullable(component))
                        .map(RecordComponent::getName)
                        .filter(model.getProperties()::containsKey)
                        .toList();
                model.setRequired(required);
            }
        }
        return resolved;
    }

    private static boolean isNullable(RecordComponent component) {
        return component.getAnnotatedType().isAnnotationPresent(Nullable.class);
    }
}
