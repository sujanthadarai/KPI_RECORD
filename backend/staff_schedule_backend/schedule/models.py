from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('instructor', 'Instructor'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='instructor')
    name = models.CharField(max_length=255)
    
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='schedule_user_set',
        blank=True,
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='schedule_user_permissions_set',
        blank=True,
    )
    
    def __str__(self):
        return self.email

class DailyReport(models.Model):
    id = models.CharField(max_length=50, primary_key=True)
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports')
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['instructor', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.instructor.name} - {self.date}"

class TimeSlot(models.Model):
    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('pending', 'Pending'),
        ('cancelled', 'Cancelled'),
    ]
    
    id = models.CharField(max_length=50, primary_key=True)
    report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='time_slots')
    start_time = models.CharField(max_length=10)  # HH:MM format
    end_time = models.CharField(max_length=10)    # HH:MM format
    description = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    class Meta:
        ordering = ['start_time']
    
    def __str__(self):
        return f"{self.report.instructor.name} - {self.start_time}-{self.end_time}"
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

class Attendance(models.Model):
    LEAVE_TYPE_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('half_day', 'Half Day'),
        ('leave', 'On Leave'),
    ]
    
    instructor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendances')
    date = models.DateField()
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES, default='present')
    
    # Additional fields
    check_in = models.TimeField(null=True, blank=True)
    check_out = models.TimeField(null=True, blank=True)
    is_late = models.BooleanField(default=False)
    is_early_leave = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        unique_together = ['instructor', 'date']
        ordering = ['-date']
    
    def __str__(self):
        return f"{self.instructor.name} - {self.date} - {self.leave_type}"