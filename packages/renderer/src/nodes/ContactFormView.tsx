import type { ContactFormNode } from "@strata/schema";
import { useEditingAdapter } from "../adapter";
import { contactFields } from "../model";
import { useSectionRenderState } from "../RenderState";
import type { NodeProps } from "./NodeView";
import { targetOf, valueOf } from "./slots";

export function ContactFormView({ node, scope }: NodeProps<ContactFormNode>) {
  const adapter = useEditingAdapter();
  const { context } = useSectionRenderState();
  const submitLabel = valueOf(node.submitLabel, scope);
  const successMessage = valueOf(node.successMessage, scope);
  const state = context.formState?.sectionId === scope.instanceId ? context.formState : undefined;

  if (state?.status === "success") {
    return (
      <p className="st-form__success" role="status">
        {successMessage.text}
      </p>
    );
  }

  const invalid = state?.status === "invalid" ? state : undefined;
  const prefix = `contact-${scope.instanceId}`;

  return (
    <form
      className="st-form"
      method="post"
      action={context.formAction}
      noValidate={invalid ? true : undefined}
    >
      <input type="hidden" name="sectionId" value={scope.instanceId} />
      <input type="hidden" name="pageId" value={context.pageId} />
      {contactFields.map((field) => {
        const id = `${prefix}-${field.name}`;
        const error = invalid?.errors[field.name];
        const errorId = `${id}-error`;
        const common = {
          id,
          name: field.name,
          required: field.required || undefined,
          maxLength: field.maxLength,
          autoComplete: field.autoComplete,
          defaultValue: invalid?.values[field.name],
          "aria-invalid": error ? ("true" as const) : undefined,
          "aria-describedby": error ? errorId : undefined,
        };
        return (
          <div key={field.name} className="st-form__field">
            <label htmlFor={id}>
              {field.label}
              {field.required ? null : <span className="st-form__optional"> (optional)</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea rows={6} {...common} />
            ) : (
              <input type={field.type} {...common} />
            )}
            {error ? (
              <p className="st-form__error" id={errorId}>
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="st-form__hp" aria-hidden="true">
        <label htmlFor={`${prefix}-website`}>Website</label>
        <input id={`${prefix}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="st-button-row">
        <button className="st-button st-button--primary" type="submit">
          {adapter?.text
            ? adapter.text({
                slot: node.submitLabel,
                value: submitLabel,
                target: targetOf(node.submitLabel, scope),
              })
            : submitLabel.text}
        </button>
      </div>
    </form>
  );
}
