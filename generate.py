import random
import hashlib
from faker import Faker

fake = Faker()
random.seed(42)

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------
NUM_STUDENTS  = 100000
NUM_LECTURERS = 200
NUM_ADMINS    = 5
NUM_COURSES   = 200
OUTPUT_FILE   = "random_data.sql"
BATCH_SIZE    = 5000

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# ID ranges
ADMIN_START    = 1
ADMIN_END      = NUM_ADMINS
LECTURER_START = NUM_ADMINS + 1
LECTURER_END   = NUM_ADMINS + NUM_LECTURERS
STUDENT_START  = NUM_ADMINS + NUM_LECTURERS + 1
STUDENT_END    = NUM_ADMINS + NUM_LECTURERS + NUM_STUDENTS

print("=" * 50)
print("  Course Management Seed Data Generator")
print("=" * 50)

# ------------------------------------------------------------------
# Helper: write inserts in batches
# ------------------------------------------------------------------
def write_inserts(f, table, columns, rows, batch_size=BATCH_SIZE):
    col_str = ", ".join(columns)
    for row in rows:
        f.write(f"INSERT INTO {table} ({col_str}) VALUES {row};\n")
    f.write("COMMIT;\n\n")

# ------------------------------------------------------------------
# Generate data
# ------------------------------------------------------------------

# ---- 1. USERS ------------------------------------------------
print("\n[1/9] Generating users...")

admin_rows    = []
lecturer_rows = []
student_rows  = []

for i in range(1, NUM_ADMINS + 1):
    uid   = i
    uname = f"admin{i}"
    first = fake.first_name().replace("'", "")
    last  = fake.last_name().replace("'", "")
    email = f"admin{i}@school.edu"
    password = fake.password(length=12)
    phash = hash_password(password)
    admin_rows.append(f"({uid}, '{uname}', '{phash}', 'admin', '{first}', '{last}', '{email}')")

for i in range(1, NUM_LECTURERS + 1):
    uid   = LECTURER_START + i - 1
    uname = f"lecturer{i}"
    first = fake.first_name().replace("'", "")
    last  = fake.last_name().replace("'", "")
    email = f"lecturer{i}@school.edu"
    password = fake.password(length=12)
    phash = hash_password(password)
    lecturer_rows.append(f"({uid}, '{uname}', '{phash}', 'lecturer', '{first}', '{last}', '{email}')")

for i in range(1, NUM_STUDENTS + 1):
    uid   = STUDENT_START + i - 1
    uname = f"student{i}"
    first = fake.first_name().replace("'", "")
    last  = fake.last_name().replace("'", "")
    email = f"student{i}@school.edu"
    password = fake.password(length=12)
    phash = hash_password(password)
    student_rows.append(f"({uid}, '{uname}', '{phash}', 'student', '{first}', '{last}', '{email}')")

print(f"    Admins:    {len(admin_rows)}")
print(f"    Lecturers: {len(lecturer_rows)}")
print(f"    Students:  {len(student_rows):,}")

# ---- 2. COURSES ----------------------------------------------
print("\n[2/9] Generating courses...")

subjects = [
    "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
    "History", "Geography", "Literature", "Economics", "Philosophy",
    "Psychology", "Sociology", "Political Science", "Statistics", "Calculus",
    "Linear Algebra", "Data Structures", "Algorithms", "Networking", "Databases",
    "Operating Systems", "Compiler Design", "Software Engineering", "Artificial Intelligence",
    "Machine Learning", "Cybersecurity", "Web Development", "Mobile Development",
    "Cloud Computing", "DevOps"
]

# Assign courses to lecturers: each gets 1-5, minimum 1 guaranteed
lecturer_ids    = list(range(LECTURER_START, LECTURER_END + 1))
lecturer_load   = {lid: 0 for lid in lecturer_ids}
course_lecturer = {}  # course_id -> lecturer_id

# Guarantee every lecturer gets at least 1 course
assignment_pool = lecturer_ids.copy()
random.shuffle(assignment_pool)

# Pad pool to NUM_COURSES respecting max 5 per lecturer
while len(assignment_pool) < NUM_COURSES:
    eligible = [lid for lid in lecturer_ids if lecturer_load[lid] < 5]
    pick = random.choice(eligible)
    assignment_pool.append(pick)

random.shuffle(assignment_pool)

used_codes  = set()
course_rows = []

for cid in range(1, NUM_COURSES + 1):
    lid = assignment_pool[cid - 1]
    lecturer_load[lid] += 1
    course_lecturer[cid] = lid

    subject = random.choice(subjects)
    prefix  = subject[:4].upper().replace(" ", "")
    code    = f"{prefix}{random.randint(1000, 4999)}"
    while code in used_codes:
        code = f"{prefix}{random.randint(1000, 4999)}"
    used_codes.add(code)

    name = f"{subject} {code[-4:]}"
    desc = fake.sentence(nb_words=10).replace("'", "")
    course_rows.append(f"({cid}, '{code}', '{name}', '{desc}', {lid}, {lid})")

print(f"    Courses: {len(course_rows)}")

# ---- 3. ENROLLMENTS ------------------------------------------
print("\n[3/9] Generating enrollments...")
print("    Guaranteeing each course has at least 10 students...")

student_ids      = list(range(STUDENT_START, STUDENT_END + 1))
student_courses  = {sid: set() for sid in student_ids}
course_students  = {cid: set() for cid in range(1, NUM_COURSES + 1)}
enrollment_pairs = []

# Step 1: guarantee 10 students per course
shuffled = student_ids.copy()
random.shuffle(shuffled)
ptr = 0

for cid in range(1, NUM_COURSES + 1):
    enrolled = 0
    attempts = 0
    while enrolled < 10:
        sid = shuffled[ptr % len(shuffled)]
        ptr += 1
        attempts += 1
        if cid not in student_courses[sid] and len(student_courses[sid]) < 6:
            student_courses[sid].add(cid)
            course_students[cid].add(sid)
            enrollment_pairs.append((sid, cid))
            enrolled += 1
        if attempts > NUM_STUDENTS * 2:
            break

# Step 2: guarantee every student has at least 3 courses
print("    Guaranteeing each student has at least 3 courses...")
course_list = list(range(1, NUM_COURSES + 1))

for sid in student_ids:
    while len(student_courses[sid]) < 3:
        cid = random.choice(course_list)
        if cid not in student_courses[sid]:
            student_courses[sid].add(cid)
            course_students[cid].add(sid)
            enrollment_pairs.append((sid, cid))

# Step 3: some students take up to 6 courses for realism
print("    Adding optional extra enrollments...")
sample = random.sample(student_ids, NUM_STUDENTS // 2)
for sid in sample:
    slots = random.randint(0, 6 - len(student_courses[sid]))
    for _ in range(slots):
        cid = random.choice(course_list)
        if cid not in student_courses[sid]:
            student_courses[sid].add(cid)
            course_students[cid].add(sid)
            enrollment_pairs.append((sid, cid))

enrollment_rows = [
    f"({eid}, {cid}, {sid})"
    for eid, (sid, cid) in enumerate(enrollment_pairs, start=1)
]
print(f"    Total enrollments: {len(enrollment_rows):,}")

# ---- 4. COURSE SECTIONS --------------------------------------
print("\n[4/9] Generating course sections...")

section_titles     = ["Introduction", "Core Concepts", "Advanced Topics",
                      "Practical Work", "Revision", "Assessment Prep"]
section_rows       = []
course_section_map = {}
sec_counter        = 1

for cid in range(1, NUM_COURSES + 1):
    count = random.randint(2, 4)
    course_section_map[cid] = []
    for order in range(count):
        title = section_titles[order % len(section_titles)]
        section_rows.append(f"({sec_counter}, {cid}, '{title}', {order})")
        course_section_map[cid].append(sec_counter)
        sec_counter += 1

print(f"    Sections: {len(section_rows)}")

# ---- 5. COURSE CONTENT ---------------------------------------
print("\n[5/9] Generating course content...")

content_types = ['link', 'file', 'slide']
content_rows  = []
con_counter   = 1

for cid, sections in course_section_map.items():
    lid = course_lecturer[cid]
    for sec_id in sections:
        count = random.randint(2, 5)
        for k in range(count):
            ctype = random.choice(content_types)
            title = fake.catch_phrase().replace("'", "")[:80]
            url   = f"https://school.edu/content/{cid}/{sec_id}/{k + 1}"
            content_rows.append(f"({con_counter}, {sec_id}, {lid}, '{ctype}', '{title}', '{url}')")
            con_counter += 1

print(f"    Content items: {len(content_rows)}")

# ---- 6. CALENDAR EVENTS --------------------------------------
print("\n[6/9] Generating calendar events...")

event_names = ["Midterm Exam", "Quiz", "Lab Session", "Guest Lecture",
               "Project Deadline", "Final Exam", "Tutorial", "Workshop"]
event_rows  = []
ev_counter  = 1

for cid in range(1, NUM_COURSES + 1):
    lid   = course_lecturer[cid]
    count = random.randint(2, 5)
    for _ in range(count):
        name       = random.choice(event_names)
        month      = random.randint(1, 12)
        day        = random.randint(1, 28)
        hour       = random.randint(8, 17)
        event_date = f"2024-{month:02d}-{day:02d} {hour:02d}:00:00"
        end_date   = f"2024-{month:02d}-{day:02d} {min(hour + 2, 23):02d}:00:00"
        desc       = fake.sentence(nb_words=6).replace("'", "")
        event_rows.append(f"({ev_counter}, {cid}, '{name}', '{desc}', '{event_date}', '{end_date}', {lid})")
        ev_counter += 1

print(f"    Events: {len(event_rows)}")

# ---- 7. FORUMS + THREADS -------------------------------------
print("\n[7/9] Generating forums and threads...")

forum_titles     = ["General Discussion", "Assignment Help", "Study Groups", "Announcements"]
forum_rows       = []
course_forum_map = {}
for_counter      = 1

for cid in range(1, NUM_COURSES + 1):
    lid   = course_lecturer[cid]
    count = random.randint(1, 3)
    course_forum_map[cid] = []
    for j in range(count):
        title = forum_titles[j % len(forum_titles)]
        desc  = fake.sentence(nb_words=8).replace("'", "")
        forum_rows.append(f"({for_counter}, {cid}, '{title}', '{desc}', {lid})")
        course_forum_map[cid].append(for_counter)
        for_counter += 1

thread_titles  = ["Help needed", "Question about lecture", "Study tips",
                  "Assignment clarification", "Exam prep", "Sharing resources",
                  "Confused about topic", "Great lecture today"]
thread_rows    = []
thr_counter    = 1
sample_studs   = random.sample(student_ids, min(5000, NUM_STUDENTS))

for cid, forums in course_forum_map.items():
    for fid in forums:
        count = random.randint(2, 5)
        for _ in range(count):
            author = random.choice(sample_studs)
            title  = random.choice(thread_titles).replace("'", "")
            body   = fake.paragraph(nb_sentences=3).replace("'", "")
            thread_rows.append(f"({thr_counter}, {fid}, {author}, '{title}', '{body}')")
            thr_counter += 1

print(f"    Forums:  {len(forum_rows)}")
print(f"    Threads: {len(thread_rows)}")

# ---- 8. ASSIGNMENTS ------------------------------------------
print("\n[8/9] Generating assignments...")

assignment_rows   = []
course_assign_map = {}
asgn_counter      = 1

for cid in range(1, NUM_COURSES + 1):
    lid   = course_lecturer[cid]
    count = random.randint(2, 4)
    course_assign_map[cid] = []
    for j in range(count):
        title    = f"Assignment {j + 1}"
        desc     = fake.sentence(nb_words=8).replace("'", "")
        due_date = f"2024-{random.randint(1,12):02d}-{random.randint(1,28):02d} 23:59:00"
        assignment_rows.append(
            f"({asgn_counter}, {cid}, {lid}, '{title}', '{desc}', '{due_date}', 100.00)"
        )
        course_assign_map[cid].append(asgn_counter)
        asgn_counter += 1

print(f"    Assignments: {len(assignment_rows)}")

# ---- 9. SUBMISSIONS ------------------------------------------
print("\n[9/9] Generating submissions...")

submission_rows = []
sub_counter     = 1

for cid in range(1, NUM_COURSES + 1):
    lid      = course_lecturer[cid]
    enrolled = list(course_students[cid])
    sample   = random.sample(enrolled, min(20, len(enrolled)))
    for aid in course_assign_map[cid]:
        for sid in sample:
            grade   = round(random.uniform(40, 100), 2)
            sub_url = f"https://school.edu/submissions/{aid}/{sid}"
            submission_rows.append(
                f"({sub_counter}, {aid}, {sid}, '{sub_url}', {grade}, {lid})"
            )
            sub_counter += 1

print(f"    Submissions: {len(submission_rows):,}")

# ------------------------------------------------------------------
# Write SQL file
# ------------------------------------------------------------------
print(f"\nWriting to {OUTPUT_FILE}...")

with open(OUTPUT_FILE, "w") as f:
    f.write("-- =====================================================\n")
    f.write("-- Course Management System - Generated Data\n")
    f.write("-- =====================================================\n\n")
    f.write("USE course_management;\n\n")
    f.write("SET GLOBAL sql_mode = '';\n")
    f.write("SET SESSION sql_mode = '';\n\n")
    f.write("SET FOREIGN_KEY_CHECKS = 0;\n")
    f.write("SET autocommit = 0;\n")
    f.write("SET unique_checks = 0;\n\n")

    cols = ["user_id","username","password_hash","role","first_name","last_name","email"]
    f.write("-- ADMINS\n")
    write_inserts(f, "users", cols, admin_rows)
    f.write("-- LECTURERS\n")
    write_inserts(f, "users", cols, lecturer_rows)
    f.write("-- STUDENTS\n")
    write_inserts(f, "users", cols, student_rows)

    f.write("-- COURSES\n")
    write_inserts(f, "courses",
              ["course_id","course_code","course_name","description","lecturer_id","created_by"],
              course_rows)

    f.write("-- COURSE ENROLLMENTS\n")
    write_inserts(f, "course_enrollments",
                  ["enrollment_id","course_id","student_id"],
                  enrollment_rows)

    f.write("-- COURSE SECTIONS\n")
    write_inserts(f, "course_sections",
                  ["section_id","course_id","title","sort_order"],
                  section_rows)

    f.write("-- COURSE CONTENT\n")
    write_inserts(f, "course_content",
                  ["content_id","section_id","uploaded_by","content_type","title","content_url"],
                  content_rows)

    f.write("-- CALENDAR EVENTS\n")
    write_inserts(f, "calendar_events",
                  ["event_id","course_id","title","description","event_date","end_date","created_by"],
                  event_rows)

    f.write("-- FORUMS\n")
    write_inserts(f, "forums",
                  ["forum_id","course_id","title","description","created_by"],
                  forum_rows)

    f.write("-- THREADS\n")
    write_inserts(f, "threads",
                  ["thread_id","forum_id","author_id","title","body"],
                  thread_rows)

    f.write("-- ASSIGNMENTS\n")
    write_inserts(f, "assignments",
                  ["assignment_id","course_id","created_by","title","description","due_date","max_grade"],
                  assignment_rows)

    f.write("-- SUBMISSIONS\n")
    write_inserts(f, "submissions",
                  ["submission_id","assignment_id","student_id","submission_url","grade","graded_by"],
                  submission_rows)

    f.write("SET FOREIGN_KEY_CHECKS = 1;\n")
    f.write("SET unique_checks = 1;\n")
    f.write("COMMIT;\n")

print("\n" + "=" * 50)
print("  SUMMARY")
print("=" * 50)
print(f"  Admins:       {NUM_ADMINS}")
print(f"  Lecturers:    {NUM_LECTURERS}")
print(f"  Students:     {NUM_STUDENTS:,}")
print(f"  Courses:      {NUM_COURSES}")
print(f"  Enrollments:  {len(enrollment_rows):,}")
print(f"  Sections:     {len(section_rows)}")
print(f"  Content:      {len(content_rows)}")
print(f"  Events:       {len(event_rows)}")
print(f"  Forums:       {len(forum_rows)}")
print(f"  Threads:      {len(thread_rows)}")
print(f"  Assignments:  {len(assignment_rows)}")
print(f"  Submissions:  {len(submission_rows):,}")
print(f"\n  Output:       {OUTPUT_FILE}")
print("=" * 50)