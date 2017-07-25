Zuora Bill To Contact cloning script
====================================

Zuora typically creates a symbolic link for its Sold To contact, pointing to its Bill To contact.

This script takes a list of Zuora account IDs and creates an independent Sold To contact object (if one doesn't exist already) by cloning the Bill To contact.

The script is idempotent in that it compares the BillToId and SoldToId fields on an Account to confirm whether it needs to do the update.

Typically it takes around 2 seconds to orchestrate the 4 API calls. This could be speed up by providing a CSV of \[Account ID, Bill To ID\] of Accounts you already know share the same Contact, and skipping the first API call, however that would not be idempotent.

