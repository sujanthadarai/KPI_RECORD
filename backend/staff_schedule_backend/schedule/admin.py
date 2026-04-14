from django.contrib import admin
from .models import User, DailyReport, TimeSlot, Attendance

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['email', 'name', 'role', 'is_active']
    list_filter = ['role']

@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'instructor', 'date', 'updated_at']
    list_filter = ['date']

@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ['id', 'report', 'start_time', 'end_time', 'status']
    list_filter = ['status']

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ['instructor', 'date', 'leave_type']
    list_filter = ['date', 'leave_type']