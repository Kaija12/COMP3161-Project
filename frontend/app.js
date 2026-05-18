const API = "http://localhost:3000/api";

function go(p){ window.location=p }
function getToken(){ return localStorage.getItem("token") }
function logout(){ localStorage.removeItem("token"); window.location='login.html' }

async function api(path, method="GET", body=null){
  const res = await fetch(`${API}${path}`,{
    method,
    headers:{"Content-Type":"application/json", Authorization:`Bearer ${getToken()}`},
    body: body ? JSON.stringify(body) : null
  });
  return res.json();
}

// COURSES
async function loadCourses(){
  const d = await api('/courses');
  courses.innerHTML = d.map(c=>`<li>${c.name||JSON.stringify(c)}</li>`).join('');
}

async function createCourse(){
  await api('/courses','POST',{name:courseName.value});
  alert('Created');
}

async function registerCourseUI(){
  await api(`/courses/${registerCourseId.value}/register`,'POST');
  alert('Registered');
}

async function loadMembers(){
  const d = await api(`/courses/${membersCourseId.value}/members`);
  members.innerHTML = d.map(m=>`<li>${m.name||JSON.stringify(m)}</li>`).join('');
}

async function loadContent(){
  const d = await api(`/courses/${courseIdContent.value}/content`);
  content.innerHTML = d.map(c=>`<li>${c.title||JSON.stringify(c)}</li>`).join('');
}

// EVENTS
async function loadEvents(){
  const d = await api('/events');
  events.innerHTML = d.map(e=>`<li>${e.title}</li>`).join('');
}

async function createEvent(){
  await api('/events','POST',{course_id:eventCourseId.value,title:eventTitle.value});
  alert('Event created');
}

// FORUMS
async function loadForums(){
  const d = await api(`/courses/${courseId.value}/forums`);
  forums.innerHTML = d.map(f=>`<li>${f.title}</li>`).join('');
}

async function createForum(){
  await api(`/courses/${forumCourseId.value}/forums`,'POST',{title:forumTitle.value});
}

async function loadThreads(){
  const d = await api(`/forums/${forumId.value}/threads`);
  threads.innerHTML = d.map(t=>`<li>${t.title}</li>`).join('');
}

async function createThreadUI(){
  await api(`/forums/${forumId.value}/threads`,'POST',{title:threadTitle.value,content:threadContent.value});
}

// ASSIGNMENTS
async function loadAssignments(){
  const d = await api(`/courses/${courseIdA.value}/assignments`);
  assignments.innerHTML = d.map(a=>`<li>${a.title}</li>`).join('');
}

async function submitAssignment(){
  await api(`/assignments/${assignmentId.value}/submit`,'POST');
  alert('Submitted');
}

// REPORTS
async function loadReports(){
  const d = await api('/reports');
  reports.innerHTML = d.map(r=>`<li>${JSON.stringify(r)}</li>`).join('');
}
