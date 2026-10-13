#!/bin/bash
U=$1
psql -q -h localhost -U postgres -d jp <<SQL
DELETE FROM review_log WHERE card_id LIKE '$U:%';
DELETE FROM card_first_review WHERE card_id LIKE '$U:%';
DELETE FROM card_modes WHERE card_id LIKE '$U:%';
DELETE FROM cards WHERE id LIKE '$U:%';
DELETE FROM credit_ledger WHERE user_id = '$U';
DELETE FROM user_profiles WHERE user_id = '$U';
SQL
