CREATE DATABASE women_safety_analytics;
USE women_safety_analytics;

-- Table for Women
CREATE TABLE women (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    address VARCHAR(255),
    INDEX(email),  -- Index for faster searches
    INDEX(phone)   -- Index for faster searches
);

-- Table for Family Members
CREATE TABLE family_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    woman_id INT,
    name VARCHAR(100),
    phone VARCHAR(20),
    relationship VARCHAR(50),
    FOREIGN KEY (woman_id) REFERENCES women(id),
    INDEX(woman_id)  -- Index for faster searches
);

-- Table for Volunteers
CREATE TABLE volunteers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    address VARCHAR(255),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    background_verified BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
    INDEX(email),  -- Index for faster searches
    INDEX(phone)   -- Index for faster searches
);

-- Table for Incidents (reported by women)
CREATE TABLE incidents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(255),
    description TEXT,
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    reporter_id INT,
    FOREIGN KEY (reporter_id) REFERENCES women(id),  -- References women table
    INDEX(reporter_id)  -- Index for faster searches
);

-- Table for Alerts
CREATE TABLE alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT,
    volunteer_id INT,
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    INDEX(incident_id),  -- Index for faster searches
    INDEX(volunteer_id)  -- Index for faster searches
);

-- Table for Incident Volunteers (volunteers responding to incidents)
CREATE TABLE incident_volunteers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    incident_id INT,
    volunteer_id INT,
    response_time TIMESTAMP,
    FOREIGN KEY (incident_id) REFERENCES incidents(id),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    INDEX(incident_id),  -- Index for faster searches
    INDEX(volunteer_id)  -- Index for faster searches
);

-- Table for Volunteer Points (for gamification)
CREATE TABLE volunteer_points (
    id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT,
    points INT DEFAULT 0,
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    INDEX(volunteer_id)  -- Index for faster searches
);

-- Table for Volunteer Locations
CREATE TABLE volunteer_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    volunteer_id INT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    FOREIGN KEY (volunteer_id) REFERENCES volunteers(id),
    INDEX(volunteer_id)  -- Index for faster searches
);
