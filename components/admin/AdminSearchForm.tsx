import { AdminButton, AdminInput } from "./ui";

export default function AdminSearchForm({
  action,
  defaultValue,
  placeholder = "Search…",
}: {
  action: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap gap-2">
      <AdminInput
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="max-w-sm flex-1"
      />
      <AdminButton type="submit" variant="secondary">
        Search
      </AdminButton>
    </form>
  );
}
