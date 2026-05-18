CREATE DATABASE IF NOT EXISTS course_management;
USE course_management;

CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('admin','lecturer','student') NOT NULL,
    first_name    VARCHAR(100),
    last_name     VARCHAR(100),
    email         VARCHAR(150),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
    course_id   INT AUTO_INCREMENT PRIMARY KEY,
    course_code VARCHAR(20)  NOT NULL UNIQUE,
    course_name VARCHAR(150) NOT NULL,
    description TEXT,
    lecturer_id INT DEFAULT NULL,
    created_by  INT NOT NULL,          
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lecturer_id) REFERENCES users(user_id),
    FOREIGN KEY (created_by)  REFERENCES users(user_id)
);

CREATE TABLE course_enrollments (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id     INT NOT NULL,
    student_id    INT NOT NULL,
    enrolled_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_enrollment (course_id, student_id),
    FOREIGN KEY (course_id)  REFERENCES courses(course_id),
    FOREIGN KEY (student_id) REFERENCES users(user_id)
);

CREATE TABLE calendar_events (
    event_id    INT AUTO_INCREMENT PRIMARY KEY,
    course_id   INT NOT NULL,
    title       VARCHAR(150) NOT NULL,
    description TEXT,
    event_date  DATETIME NOT NULL,
    end_date    DATETIME,
    created_by  INT NOT NULL,
    FOREIGN KEY (course_id)  REFERENCES courses(course_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE forums (
    forum_id    INT AUTO_INCREMENT PRIMARY KEY,
    course_id   INT NOT NULL,
    title       VARCHAR(150) NOT NULL,
    description TEXT,
    created_by  INT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id)  REFERENCES courses(course_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE threads (
    thread_id  INT AUTO_INCREMENT PRIMARY KEY,
    forum_id   INT NOT NULL,
    author_id  INT NOT NULL,
    title      VARCHAR(150) NOT NULL,
    body       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (forum_id)  REFERENCES forums(forum_id),
    FOREIGN KEY (author_id) REFERENCES users(user_id)
);

CREATE TABLE replies (
    reply_id        INT AUTO_INCREMENT PRIMARY KEY,
    thread_id       INT NOT NULL,
    parent_reply_id INT DEFAULT NULL,
    author_id       INT NOT NULL,
    body            TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id)       REFERENCES threads(thread_id),
    FOREIGN KEY (parent_reply_id) REFERENCES replies(reply_id),
    FOREIGN KEY (author_id)       REFERENCES users(user_id)
);

CREATE TABLE course_sections (
    section_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id  INT NOT NULL,
    title      VARCHAR(150) NOT NULL,
    sort_order INT DEFAULT 0,
    FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

CREATE TABLE course_content (
    content_id   INT AUTO_INCREMENT PRIMARY KEY,
    section_id   INT NOT NULL,
    uploaded_by  INT NOT NULL,
    content_type ENUM('link','file','slide') NOT NULL,
    title        VARCHAR(150) NOT NULL,
    content_url  TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id)  REFERENCES course_sections(section_id),
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id)
);

CREATE TABLE assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    course_id     INT NOT NULL,
    created_by    INT NOT NULL,
    title         VARCHAR(150) NOT NULL,
    description   TEXT,
    due_date      DATETIME,
    max_grade     DECIMAL(5,2) DEFAULT 100.00,
    FOREIGN KEY (course_id)  REFERENCES courses(course_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

CREATE TABLE submissions (
    submission_id  INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id  INT NOT NULL,
    student_id     INT NOT NULL,
    submission_url TEXT,
    submitted_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    grade          DECIMAL(5,2) DEFAULT NULL,
    graded_at      TIMESTAMP NULL,
    graded_by      INT DEFAULT NULL,
    UNIQUE KEY uq_submission (assignment_id, student_id),
    FOREIGN KEY (assignment_id) REFERENCES assignments(assignment_id),
    FOREIGN KEY (student_id)    REFERENCES users(user_id),
    FOREIGN KEY (graded_by)     REFERENCES users(user_id)
);

-- Views
CREATE VIEW vw_large_courses AS
SELECT c.course_id, c.course_name, COUNT(e.student_id) AS student_count
FROM courses c JOIN course_enrollments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.course_name
HAVING COUNT(e.student_id) >= 50;

CREATE VIEW vw_heavy_students AS
SELECT u.user_id, u.username, COUNT(e.course_id) AS course_count
FROM users u JOIN course_enrollments e ON u.user_id = e.student_id
GROUP BY u.user_id, u.username
HAVING COUNT(e.course_id) >= 5;

CREATE VIEW vw_busy_lecturers AS
SELECT u.user_id, u.username, COUNT(c.course_id) AS course_count
FROM users u JOIN courses c ON u.user_id = c.lecturer_id
GROUP BY u.user_id, u.username
HAVING COUNT(c.course_id) >= 3;

CREATE VIEW vw_top_enrolled_courses AS
SELECT c.course_id, c.course_name, COUNT(e.student_id) AS enrollments
FROM courses c JOIN course_enrollments e ON c.course_id = e.course_id
GROUP BY c.course_id, c.course_name
ORDER BY enrollments DESC
LIMIT 10;

CREATE VIEW vw_top_students AS
SELECT u.user_id, u.username, AVG(s.grade) AS avg_grade
FROM users u JOIN submissions s ON u.user_id = s.student_id
WHERE s.grade IS NOT NULL
GROUP BY u.user_id, u.username
ORDER BY avg_grade DESC
LIMIT 10;