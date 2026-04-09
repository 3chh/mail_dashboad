type MailboxCheckboxGroupProps = {
  mailboxes: Array<{
    id: string;
    emailAddress: string;
    provider: string;
    status: string;
  }>;
  selectedMailboxIds: string[];
};

export function MailboxCheckboxGroup({
  mailboxes,
  selectedMailboxIds,
}: MailboxCheckboxGroupProps) {
  const selected = new Set(selectedMailboxIds);

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {mailboxes.map((mailbox) => (
        <label
          key={mailbox.id}
          className="subpanel-surface flex items-center gap-3 rounded-2xl px-4 py-3 text-sm"
        >
          <input
            type="checkbox"
            name="mailboxId"
            value={mailbox.id}
            defaultChecked={selected.has(mailbox.id)}
          />
          <div className="min-w-0">
            <div className="truncate font-medium">{mailbox.emailAddress}</div>
            <div className="text-xs text-muted-foreground">
              {mailbox.provider} - {mailbox.status}
            </div>
          </div>
        </label>
      ))}
    </div>
  );
}

