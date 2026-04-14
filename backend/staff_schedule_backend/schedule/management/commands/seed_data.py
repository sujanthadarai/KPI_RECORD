from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from schedule.models import User, DailyReport, TimeSlot, Attendance
from datetime import date, timedelta
import uuid

class Command(BaseCommand):
    help = 'Seed initial data for the application'
    
    def handle(self, *args, **options):
        # Create users
        users_data = [
            {'email': 'sujan@gmail.com', 'password': 'sujan', 'name': 'Admin User', 'role': 'admin'},
            {'email': 'saroj@gmail.com', 'password': 'saroj', 'name': 'saroj giri', 'role': 'instructor'},
            {'email': 'promod@gmail.com', 'password': 'pramod', 'name': 'pramod mahato', 'role': 'instructor'},
            {'email': 'priya@academy.com', 'password': 'priya123', 'name': 'Priya Patel', 'role': 'instructor'},
            {'email': 'david@academy.com', 'password': 'david123', 'name': 'David Kim', 'role': 'instructor'},
        ]
        
        for user_data in users_data:
            User.objects.update_or_create(
                email=user_data['email'],
                defaults={
                    'username': user_data['email'],
                    'password': make_password(user_data['password']),
                    'name': user_data['name'],
                    'role': user_data['role']
                }
            )
        
        instructors = User.objects.filter(role='instructor')
        today = date.today()
        
        # Create sample reports for last 3 days
        for i in range(3):
            report_date = today - timedelta(days=i)
            for instructor in instructors:
                report_id = f"r-{uuid.uuid4().hex[:8]}"
                report, created = DailyReport.objects.get_or_create(
                    id=report_id,
                    instructor=instructor,
                    date=report_date
                )
                
                if created:
                    # Create time slots
                    slots = [
                        {'id': f"ts-{uuid.uuid4().hex[:8]}", 'start_time': '09:00', 'end_time': '11:00', 
                         'description': 'Morning class: React Fundamentals', 'status': 'completed'},
                        {'id': f"ts-{uuid.uuid4().hex[:8]}", 'start_time': '11:30', 'end_time': '13:00', 
                         'description': 'JavaScript Advanced Concepts', 'status': 'completed'},
                        {'id': f"ts-{uuid.uuid4().hex[:8]}", 'start_time': '14:00', 'end_time': '16:00', 
                         'description': 'Project Review Session', 'status': 'pending'},
                    ]
                    
                    for slot_data in slots:
                        TimeSlot.objects.create(report=report, **slot_data)
        
        # Create attendance records
        for instructor in instructors:
            for i in range(5):
                attendance_date = today - timedelta(days=i)
                Attendance.objects.get_or_create(
                    instructor=instructor,
                    date=attendance_date,
                    defaults={'leave_type': 'present'}
                )
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded data'))