# Course Service — Implementation Documentation

## Data Model

`course_service.courses`: id (uuid, pk), code (unique), title, department,
faculty_user_id (uuid, no foreign key — same cross-schema reasoning as
student-service's user_id), created_at, updated_at.

## Notable Design Decision: Role-Dependent Identity Assignment

**Problem identified:** the initial implementation of `POST /courses`
always set `facultyUserId` to the identity of whoever called the endpoint
(`req.user.sub`). This is correct for a FACULTY member creating their own
course, but incorrect for an ADMIN creating a course on behalf of a
different faculty member — the course would be silently assigned to the
admin's own identity instead, breaking any future "show me the courses I
teach" query for the intended faculty member.

**Resolution:** `createCourseSchema` accepts an optional `facultyUserId`
field. The route applies role-dependent logic: if the caller's role is
ADMIN and the request body supplies a `facultyUserId`, that value is used;
otherwise, the caller's own `sub` is always used, regardless of what (if
anything) the request body contains. A non-admin caller's attempt to
specify a different `facultyUserId` is silently ignored rather than
honored — this is a deliberate IDOR-prevention measure, consistent with
the principle established in Student Service (Section on IDOR in
AUTH_SERVICE.md/STUDENT_SERVICE.md): a client-supplied identity value is
only ever trusted when the caller's verified role explicitly permits
assigning identity on another user's behalf.

**Verified by:** manual end-to-end test chain (FACULTY self-assignment,
STUDENT rejection with 403, ADMIN explicit override producing the correct
non-self facultyUserId) and 3 automated integration tests.