# Merging duplicate contacts in Clio — a runbook

**Who this is for:** a paralegal or office administrator with a Clio Manage login.
You do not need any technical background, and nothing here involves the website.

**Time:** about five minutes per duplicated person.

**Owner of the underlying fix:** SHELDON-154-CLIO-DEDUP-R1 (issue #154).

---

## 1. What happened, in plain English

When somebody books a consultation on the website, the booking system asks Clio
"do you already have this person?" before it files anything. Until now it only
asked using the **email address**.

That is not enough to recognise somebody. A client who books once from a personal
address and once from a work address looks like two different people to a question
that only knows about email — so Clio was told to create a second record, and the
firm ended up with the same client twice. **David Pierce currently has three
records** for this reason, alongside some test bookings made while we were
diagnosing it.

The booking system has now been changed to also ask about the **phone number**, so
it stops making new duplicates from here on.

> **It cannot clean up the ones already there.** Merging two live client records is
> a judgement call about real people — whether they really are the same person, and
> which details are correct. That is a human decision, and it is why this runbook
> exists rather than a script.

---

## 2. Before you start

- ⛔ **Never delete a contact.** Deleting throws away whatever was attached to it —
  matters, notes, documents, calendar history. Merging keeps everything. If you are
  not sure whether to merge, stop and ask; do not delete as a tidy-up.
- ⚠️ **Merging cannot be undone in Clio.** Take the thirty seconds in §4 to check
  you have the right two records before you confirm.
- 📌 **Do one person at a time**, start to finish. Do not select a batch.

---

## 3. Find the duplicates

1. Log in to Clio Manage and open **Contacts**.
2. Search the person's name — e.g. `David Pierce`.
3. If more than one row comes back for what looks like the same person, you have
   duplicates.
4. Open each one in its own browser tab so you can compare them side by side.

**Also worth searching:** the person's **phone number** and each **email address**
you can see on the records you found. A duplicate created from a different email
address will not always show an obviously identical name, and searching the phone
number is the quickest way to catch it.

---

## 4. Decide which record to keep

**Keep the OLDEST record** — the one with the earliest **Created** date. Open each
tab and compare.

Two reasons:

- It is normally the one with the real history on it — the matters, the notes, the
  past calendar entries, anything an attorney has already worked from.
- The booking system now deliberately attaches new bookings to the **oldest**
  matching record. So while duplicates still exist, the oldest one is the one that
  keeps receiving new information, and keeping it means nothing is stranded.

Call that one **the keeper**. The others are **the extras**.

> **If the Created dates are identical or unreadable**, keep the one with the most
> on it — matters, notes, documents. Note which one you kept in §7.

---

## 5. Check they really are the same person — before merging

Merging is permanent, so spend a moment on this. Look at both records and ask:

| Check | What you are looking for |
|---|---|
| **Name** | Same person, allowing for nicknames — *Dave* and *David* are fine. |
| **Phone** | Same number, allowing for formatting — `(561) 555-0142` and `5615550142` are the same number. |
| **Email** | Often *different* on the two records. That is expected — it is the cause of the duplicate, not evidence against a merge. |
| **Matters** | Do the matters on both records belong to the same person's affairs? |

🚩 **Stop and do not merge** if you see any of these:

- Two **different people who share a phone number** — spouses, a household line, an
  office switchboard. Same number, genuinely different clients.
- Any sign the two records belong to **opposing parties**, or to people in the same
  matter on different sides.
- Anything that makes you hesitate at all.

In any of those cases, leave both records alone and raise it with the responsible
attorney. A wrongly merged record puts one client's information onto another
client's file, and that is a worse problem than a duplicate.

---

## 6. Merge

Clio Manage merges contacts from the **Contacts** list: select the duplicate
records, then choose the **Merge** action, and Clio will ask you which record to
keep as the primary. Choose **the keeper** from §4.

> **If the option is not where this describes it**, Clio moves its menus from time
> to time. Search Clio's own Help Centre for **"merge duplicate contacts"** and
> follow their current instructions — the decision of *which* record to keep is the
> part this runbook is here for, and that does not change.

For **David Pierce specifically**: there are three records, so you will merge
twice — extra #1 into the keeper, then extra #2 into the same keeper. Re-check §5
before the second merge.

---

## 7. After each merge

1. Search the name again. You should see **one** record.
2. Open it and confirm the merged record still has:
   - every email address the separate records carried,
   - the phone number,
   - all the matters, notes and calendar entries from both.
3. If an email address from an extra record did **not** carry over, add it to the
   keeper by hand. It is worth doing: an address the record knows about is one the
   booking system can match on next time, which is one less chance of this
   recurring.
4. Write down, in whatever the firm uses for this:
   - the person's name,
   - which record you kept (its Created date),
   - how many you merged in,
   - the date you did it.

---

## 8. When you are done

Tell **David Pierce (david@ticoai.net)** which contacts were merged, and flag
anything you stopped on under §5. If a duplicate appears for a *new* booking made
after this fix ships, that is worth reporting — it means the booking system found a
case we have not covered yet, and the details of that booking are what would let us
fix it.

---

## 9. One thing to be aware of

The booking system matches a phone number as Clio has it **stored**. If the same
client's number is written in a third format somewhere — say `561-555-0142` on one
record when they type `(561) 555-0142` into the booking form — Clio's own search
will not connect the two, and a duplicate can still be created. Clio has no way to
search phone numbers ignoring punctuation, so this is a limit of the tool rather
than something a setting can fix.

**What helps:** when you tidy a contact, write phone numbers the same way every
time. The firm's usual format `(561) 555-0142` is a good default, because that is
the format the booking form itself puts on new records.
