const express = require('express');
const mysql = require('mysql2');
const twilio = require('twilio');
const app = express();
app.use(express.json());


// Twilio configuration (Replace with your own credentials)
const accountSid = '';
const authToken = '';
const client = twilio(accountSid, authToken);

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'women_safety_analytics'
});

// Volunteer Registration with location data insertion
app.post('/register_volunteer', (req, res) => {
    const { name, email, phone, address, latitude, longitude } = req.body;

    db.query(
        "INSERT INTO volunteers (name, email, phone, address, latitude, longitude, background_verified) VALUES (?, ?, ?, ?, ?, ?, false)",
        [name, email, phone, address, latitude, longitude],
        (err, results) => {
            if (err) {
                // Handle duplicate entry error
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).send({ message: 'Volunteer with this email or phone number already exists' });
                }
                console.error('Error registering volunteer:', err);
                return res.status(500).send({ message: 'Failed to register volunteer' });
            }
            const volunteerId = results.insertId;

            // Insert location data into volunteer_locations
            db.query(
                "INSERT INTO volunteer_locations (volunteer_id, latitude, longitude) VALUES (?, ?, ?)",
                [volunteerId, latitude, longitude],
                (err) => {
                    if (err) {
                        console.error('Error inserting location:', err);
                        return res.status(500).send({ message: 'Failed to insert location' });
                    }
                    res.send({ message: 'Volunteer registered successfully with location data', volunteerId });
                }
            );
        }
    );
});



// Find Nearby Volunteers
app.post('/find_nearby_volunteers', (req, res) => {
    const { incident_lat, incident_lon } = req.body;
    const query = `
        SELECT id, name, phone,
        (6371 * acos(cos(radians(?)) * cos(radians(latitude)) 
        * cos(radians(longitude) - radians(?)) 
        + sin(radians(?)) * sin(radians(latitude)))) AS distance
        FROM volunteers
        HAVING distance < 5
        ORDER BY distance;
    `;
    db.query(query, [incident_lat, incident_lon, incident_lat], (err, results) => {
        if (err) {
            console.error('Error finding volunteers:', err);
            return res.status(500).send({ message: 'Failed to find volunteers' });
        }
        res.send({ volunteers: results });
    });
});

// Report an Incident
app.post('/report_incident', (req, res) => {
    const { type, description, latitude, longitude, reporter_id } = req.body;
    const query = `INSERT INTO incidents (type, description, latitude, longitude, reporter_id) VALUES (?, ?, ?, ?, ?)`;
    db.query(query, [type, description, latitude, longitude, reporter_id], (err, result) => {
        if (err) {
            console.error('Error reporting incident:', err);
            return res.status(500).send({ message: 'Failed to report incident' });
        }
        const incidentId = result.insertId;
        // Logic to notify nearby volunteers can be added here
        res.send({ message: 'Incident reported successfully', incidentId });
    });
});

// Send Alert
app.post('/send_alert', (req, res) => {
    const { incident_id, volunteer_id, message } = req.body;
    const query = `INSERT INTO alerts (incident_id, volunteer_id, message) VALUES (?, ?, ?)`;
    db.query(query, [incident_id, volunteer_id, message], (err, result) => {
        if (err) {
            console.error('Error sending alert:', err);
            return res.status(500).send({ message: 'Failed to send alert' });
        }
        // Integrate with SMS API here (e.g., Twilio)
        res.send({ message: 'Alert sent successfully' });
    });
});


// women registration and family member registration
app.post('/register_woman', (req, res) => {
    const { name, email, phone, address, family_members } = req.body;

    // Start transaction
    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction Error:', err);
            return res.status(500).send({ error: 'Transaction failed' });
        }

        // Insert woman data
        db.query(
            "INSERT INTO women (name, email, phone, address) VALUES (?, ?, ?, ?)",
            [name, email, phone, address],
            (err, results) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Insert Woman Error:', err);
                        return res.status(500).send({ error: 'Failed to register woman' });
                    });
                }
                const womanId = results.insertId;

                // Prepare family members data for bulk insertion
                const familyMemberValues = family_members.map(member => [
                    womanId,
                    member.name,
                    member.phone,
                    member.relationship
                ]);

                if (familyMemberValues.length > 0) {
                    // Insert family members data
                    db.query(
                        "INSERT INTO family_members (woman_id, name, phone, relationship) VALUES ?",
                        [familyMemberValues],
                        (err) => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('Insert Family Members Error:', err);
                                    return res.status(500).send({ error: 'Failed to register family members' });
                                });
                            }

                            // Commit transaction
                            db.commit(err => {
                                if (err) {
                                    return db.rollback(() => {
                                        console.error('Commit Error:', err);
                                        return res.status(500).send({ error: 'Transaction commit failed' });
                                    });
                                }
                                res.send({ message: 'Woman and family members registered successfully' });
                            });
                        }
                    );
                } else {
                    // If no family members, just commit the transaction
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Commit Error:', err);
                                return res.status(500).send({ error: 'Transaction commit failed' });
                            });
                        }
                        res.send({ message: 'Woman registered successfully' });
                    });
                }
            }
        );
    });
});






// Endpoint to alert nearby volunteers and notify family members
app.post('/alert_nearby_volunteers_and_family', (req, res) => {
    const { incident_lat, incident_lon, reporter_id } = req.body;

    // 1. Find nearby volunteers
    const volunteerQuery = `
        SELECT v.id, v.name, v.phone,
        (6371 * acos(cos(radians(?)) * cos(radians(vl.latitude)) 
        * cos(radians(vl.longitude) - radians(?)) 
        + sin(radians(?)) * sin(radians(vl.latitude)))) AS distance
    FROM volunteer_locations vl
    JOIN volunteers v ON vl.volunteer_id = v.id
    HAVING distance < 5
    ORDER BY distance;
    `;

    db.query(volunteerQuery, [incident_lat, incident_lon, incident_lat], (err, volunteers) => {
        if (err) {
            console.error('Error finding volunteers:', err);
            return res.status(500).send({ message: 'Failed to find volunteers' });
        }

        // 2. Send alert to nearby volunteers
        volunteers.forEach(volunteer => {
            client.messages.create({
                body: `Emergency Alert! An incident has occurred at [${incident_lat}, ${incident_lon}]. Please assist immediately.`,
                from: '+16187653469', // Your Twilio phone number
                to: volunteer.phone
            }).then(message => console.log(`Alert sent to volunteer ${volunteer.name} at ${volunteer.phone}, Message SID: ${message.sid}`))
              .catch(error => console.error('Error sending SMS to volunteer:', error));
        });

        // 3. Retrieve the family members of the woman who reported the incident
        const familyQuery = `
            SELECT fm.name, fm.phone FROM family_members fm
            JOIN women w ON fm.woman_id = w.id
            WHERE w.id = ?;
        `;

        db.query(familyQuery, [reporter_id], (err, familyMembers) => {
            if (err) {
                console.error('Error finding family members:', err);
                return res.status(500).send({ message: 'Failed to notify family members' });
            }

            // 4. Send SMS to family members
            familyMembers.forEach(member => {
                client.messages.create({
                    body: `Emergency Alert! Your family member has reported an incident at [${incident_lat}, ${incident_lon}].`,
                    from: '+16187653469', // Your Twilio phone number
                    to: member.phone
                }).then(message => console.log(`SMS sent to family member ${member.name} at ${member.phone}, Message SID: ${message.sid}`))
                  .catch(error => console.error('Error sending SMS to family member:', error));
            });

            res.send({ message: 'Alerts sent to nearby volunteers and family members' });
        });
    });
});


app.get('/allgood', (req, res) => {
  res.send({ message: 'All good!' });
});



app.get('/login', (req, res) => {
  const {email, password} = req.query;
  if(email && password){
    if(email === 'nitin@gmail.com' && password === '123456'){
      res.send({message: 'Login successful'});
    }else{
      res.send({message: 'Invalid email or password'});
    }
  }else{
    res.send({message: 'MisMatch in email or password'});
  }
});

// getting women details for dashborad
app.post('/women_details', (req, res) => {
    const { id } = req.body;  // Use req.body instead of req.query
  
    // Debug: Log the received ID
    console.log('Received ID:', id);
  
    if (id) {
      const query = `
        SELECT 
          w.id AS woman_id, 
          w.name AS woman_name, 
          w.email AS woman_email, 
          w.phone AS woman_phone, 
          w.address AS woman_address,
          fm.id AS family_member_id, 
          fm.name AS family_member_name, 
          fm.phone AS family_member_phone, 
          fm.relationship AS family_member_relationship
        FROM women w
        LEFT JOIN family_members fm ON w.id = fm.woman_id
        WHERE w.id = ?;
      `;
  
      // Debug: Log the query before execution
      console.log('Executing Query:', query);
  
      db.query(query, [id], (err, results) => {
        if (err) {
          console.error('Error fetching women details:', err);
          return res.status(500).send({ message: 'Failed to fetch women details' });
        }
  
        // Debug: Log the results returned by the query
        console.log('Query Results:', results);
  
        if (results.length > 0) {
          const womanDetails = {
            id: results[0].woman_id,
            name: results[0].woman_name,
            email: results[0].woman_email,
            phone: results[0].woman_phone,
            address: results[0].woman_address,
            family_members: results.map(row => ({
              id: row.family_member_id,
              name: row.family_member_name,
              phone: row.family_member_phone,
              relationship: row.family_member_relationship
            })).filter(member => member.id !== null)
          };
          res.send({ woman: womanDetails });
        } else {
          // Debug: If no results found
          console.log('No details found for the given ID');
          res.send({ message: 'No details found for the given ID' });
        }
      });
    } else {
      // Debug: If ID is not provided or invalid
      console.log('Invalid ID provided');
      res.status(400).send({ message: 'Invalid ID' });
    }
  });
  
  
  
  


// Start the server
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
