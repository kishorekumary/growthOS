#!/bin/sh
# Writes the cron job using the runtime CRON_SECRET, then starts crond in foreground
apk add --no-cache curl > /dev/null 2>&1

echo "0 0,8,16 * * * curl -s -X GET http://app:3000/api/cron/reminders -H \"Authorization: Bearer ${CRON_SECRET}\" >> /var/log/cron.log 2>&1" | crontab -

echo "Cron service started — reminders scheduled at 00:00, 08:00, 16:00 UTC"
crond -f -l 6
