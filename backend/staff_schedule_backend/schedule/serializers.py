from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, DailyReport, TimeSlot, Attendance

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role', 'password']
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'username': {'required': False}
        }
    
    def create(self, validated_data):
        if 'username' not in validated_data or not validated_data['username']:
            validated_data['username'] = validated_data['email']
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data['password'])
        return super().update(instance, validated_data)

class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ['id', 'report', 'start_time', 'end_time', 'description', 'status']
    
    def to_representation(self, instance):
        # For nested representation, use report_id instead of full report object
        data = super().to_representation(instance)
        data['reportId'] = data.pop('report')
        return data

class DailyReportSerializer(serializers.ModelSerializer):
    time_slots = TimeSlotSerializer(many=True, read_only=True)
    instructor_id = serializers.CharField(source='instructor.id', read_only=True)
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    
    class Meta:
        model = DailyReport
        fields = ['id', 'instructor_id', 'instructor_name', 'date', 'time_slots', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


from rest_framework import serializers
from .models import Attendance
from django.contrib.auth import get_user_model

User = get_user_model()

class AttendanceSerializer(serializers.ModelSerializer):
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    instructor_id = serializers.IntegerField(source='instructor.id', read_only=True)
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'instructor', 'instructor_name', 'instructor_id', 'date',
            'leave_type', 'check_in', 'check_out', 'is_late', 
            'is_early_leave', 'notes'
        ]
        read_only_fields = ['id']
class KPISerializer(serializers.Serializer):
    instructorId = serializers.CharField()
    instructorName = serializers.CharField()
    totalClasses = serializers.IntegerField()
    totalWorkingHours = serializers.FloatField()
    attendanceScore = serializers.FloatField()
    taskCompletionScore = serializers.FloatField()
    timeDisciplineScore = serializers.FloatField()
    finalKPI = serializers.FloatField()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'role']
  
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import User, DailyReport, TimeSlot, Attendance
import uuid

class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ['id', 'start_time', 'end_time', 'description', 'status']
        read_only_fields = ['id']

class DailyReportSerializer(serializers.ModelSerializer):
    time_slots = TimeSlotSerializer(many=True, read_only=True)
    instructor_id = serializers.CharField(source='instructor.id', read_only=True)
    instructor_name = serializers.CharField(source='instructor.name', read_only=True)
    
    class Meta:
        model = DailyReport
        fields = ['id', 'instructor_id', 'instructor_name', 'date', 'time_slots', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
class DailyReportCreateSerializer(serializers.ModelSerializer):
    time_slots = TimeSlotSerializer(many=True, required=True)
    
    class Meta:
        model = DailyReport
        fields = ['date', 'time_slots']
    
    def validate(self, data):
        """Validate the data before creating"""
        if not data.get('date'):
            raise serializers.ValidationError({"date": "Date is required"})
        if not data.get('time_slots'):
            raise serializers.ValidationError({"time_slots": "At least one time slot is required"})
        return data
    
    def create(self, validated_data):
        time_slots_data = validated_data.pop('time_slots')
        validated_data['instructor'] = self.context['request'].user
        
        # Generate report ID
        report_id = f"r-{uuid.uuid4().hex[:8]}"
        
        # Create the report
        report = DailyReport.objects.create(id=report_id, **validated_data)
        
        # Create time slots
        for slot_data in time_slots_data:
            slot_id = f"ts-{uuid.uuid4().hex[:8]}"
            TimeSlot.objects.create(
                id=slot_id,
                report=report,
                start_time=slot_data['start_time'],
                end_time=slot_data['end_time'],
                description=slot_data['description'],
                status=slot_data['status']
            )
        
        return report
    
    def update(self, instance, validated_data):
        time_slots_data = validated_data.pop('time_slots', None)
        instance.date = validated_data.get('date', instance.date)
        instance.save()
        
        if time_slots_data is not None:
            # Delete existing slots
            instance.time_slots.all().delete()
            
            # Create new slots
            for slot_data in time_slots_data:
                slot_id = f"ts-{uuid.uuid4().hex[:8]}"
                TimeSlot.objects.create(
                    id=slot_id,
                    report=instance,
                    start_time=slot_data['start_time'],
                    end_time=slot_data['end_time'],
                    description=slot_data['description'],
                    status=slot_data['status']
                )
        
        return instance