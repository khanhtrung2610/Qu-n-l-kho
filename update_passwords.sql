-- Update passwords to hashed versions for existing users
UPDATE users SET password_hash = 'scrypt:32768:8:1$iptnz0m1vpH8J4dg$dd3efef6d41533803ab31bc558a9cb56e3135423d446c207dc4fc44e3ae8eb6d2ec46155e3c456390057a56ec5507fef9dad2b8b884c609766dda6bce2d21fa3' WHERE username = 'manager1';
UPDATE users SET password_hash = 'scrypt:32768:8:1$iptnz0m1vpH8J4dg$dd3efef6d41533803ab31bc558a9cb56e3135423d446c207dc4fc44e3ae8eb6d2ec46155e3c456390057a56ec5507fef9dad2b8b884c609766dda6bce2d21fa3' WHERE username = 'staff1';
