from datetime import datetime, timedelta
from django.db.models import Count, Q, Sum, F, FloatField
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status, permissions, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from .models import User, DailyReport, TimeSlot, Attendance
from .serializers import (
    UserSerializer, DailyReportSerializer, DailyReportCreateSerializer,
    AttendanceSerializer, KPISerializer
)
from django.utils import timezone

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Allow login with either username or email
        username_or_email = attrs.get('username')
        password = attrs.get('password')
        
        # Try to find user by email first
        user = None
        try:
            user = User.objects.get(email=username_or_email)
            username = user.username
        except User.DoesNotExist:
            username = username_or_email
        
        # Authenticate with username
        authenticated_user = authenticate(username=username, password=password)
        
        if authenticated_user:
            attrs['username'] = authenticated_user.username
            return super().validate(attrs)
        else:
            raise serializers.ValidationError('No active account found with the given credentials')

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        
        try:
            serializer.is_valid(raise_exception=True)
        except Exception as e:
            return Response(
                {'error': 'Invalid credentials. Please check your username and password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        response = Response(serializer.validated_data, status=status.HTTP_200_OK)
        
        if response.status_code == 200:
            try:
                # Get user from the validated data
                user = User.objects.get(username=serializer.validated_data.get('username'))
                user_data = UserSerializer(user).data
                response.data['user'] = user_data
            except User.DoesNotExist:
                pass
        
        return response

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        return User.objects.filter(id=user.id)
class DailyReportViewSet(viewsets.ModelViewSet):
    queryset = DailyReport.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return DailyReportCreateSerializer
        return DailyReportSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return DailyReport.objects.all()
        return DailyReport.objects.filter(instructor=user)
    
    def create(self, request, *args, **kwargs):
        print("=" * 50)
        print("Creating/Updating report with data:", request.data)
        print("=" * 50)
        
        user = request.user
        date = request.data.get('date')
        
        # Check if report already exists for this instructor and date
        existing_report = DailyReport.objects.filter(
            instructor=user, 
            date=date
        ).first()
        
        if existing_report:
            # Update existing report
            print(f"Found existing report {existing_report.id}, updating...")
            
            # Update the report data
            serializer = self.get_serializer(
                existing_report, 
                data=request.data, 
                partial=True,
                context={'request': request}
            )
            
            if not serializer.is_valid():
                print("Serializer errors:", serializer.errors)
                return Response(
                    {'error': 'Validation failed', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                self.perform_update(serializer)
                return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                print("Exception during update:", str(e))
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': 'Failed to update report', 'detail': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Create new report
            print("No existing report found, creating new...")
            serializer = self.get_serializer(data=request.data, context={'request': request})
            
            if not serializer.is_valid():
                print("Serializer errors:", serializer.errors)
                return Response(
                    {'error': 'Validation failed', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                self.perform_create(serializer)
                headers = self.get_success_headers(serializer.data)
                return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
            except Exception as e:
                print("Exception during creation:", str(e))
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': 'Failed to create report', 'detail': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.shortcuts import get_object_or_404
from .models import Attendance
from .serializers import AttendanceSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Attendance.objects.all()
        return Attendance.objects.filter(instructor=user)
    
    def create(self, request, *args, **kwargs):
        user = request.user
        
        # Determine the instructor ID
        if user.role == 'admin':
            # Admin can specify instructor, default to themselves
            instructor_id = request.data.get('instructor', user.id)
            try:
                instructor_id = int(instructor_id)
            except (ValueError, TypeError):
                instructor_id = user.id
        else:
            # Non-admin always uses their own ID
            instructor_id = user.id
        
        date = request.data.get('date', timezone.now().date())
        
        # Prepare data for update/create
        update_data = {
            'leave_type': request.data.get('leave_type', 'present'),
            'check_in': request.data.get('check_in'),
            'check_out': request.data.get('check_out'),
            'is_late': request.data.get('is_late', False),
            'is_early_leave': request.data.get('is_early_leave', False),
            'notes': request.data.get('notes', ''),
        }
        
        # Get or create attendance record
        attendance, created = Attendance.objects.get_or_create(
            instructor_id=instructor_id,
            date=date,
            defaults=update_data
        )
        
        if not created:
            # Update existing record
            for key, value in update_data.items():
                setattr(attendance, key, value)
            attendance.save()
        
        serializer = self.get_serializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        
        # Check permissions
        if user.role != 'admin' and instance.instructor != user:
            return Response(
                {'error': 'You can only update your own attendance records'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Update only allowed fields
        allowed_fields = ['leave_type', 'check_in', 'check_out', 'is_late', 'is_early_leave', 'notes']
        for field in allowed_fields:
            if field in request.data:
                setattr(instance, field, request.data[field])
        
        instance.save()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='by-date')
    def by_date(self, request):
        date = request.query_params.get('date')
        if not date:
            return Response({'error': 'Date parameter required'}, status=400)
        
        attendances = self.get_queryset().filter(date=date)
        serializer = self.get_serializer(attendances, many=True)
        return Response(serializer.data)
    
class KPICalculatorViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        """Calculate KPIs for all instructors"""
        instructors = User.objects.filter(role='instructor')
        kpi_data = []
        
        for instructor in instructors:
            # Get reports for last 30 days
            thirty_days_ago = datetime.now().date() - timedelta(days=30)
            reports = DailyReport.objects.filter(
                instructor=instructor,
                date__gte=thirty_days_ago
            )
            
            # Calculate total classes (time slots)
            total_classes = TimeSlot.objects.filter(
                report__in=reports
            ).count()
            
            # Calculate total working hours
            total_hours = 0
            for report in reports:
                for slot in report.time_slots.all():
                    try:
                        start = datetime.strptime(slot.start_time, '%H:%M')
                        end = datetime.strptime(slot.end_time, '%H:%M')
                        hours = (end - start).seconds / 3600
                        if hours < 0:
                            hours += 24
                        total_hours += hours
                    except:
                        pass
            
            # Attendance score (based on attendance records)
            attendances = Attendance.objects.filter(
                instructor=instructor,
                date__gte=thirty_days_ago
            )
            total_days = 30
            present_days = attendances.filter(leave_type='present').count()
            half_days = attendances.filter(leave_type='half_day').count()
            attendance_score = ((present_days + (half_days * 0.5)) / total_days) * 100 if total_days > 0 else 0
            
            # Task completion score
            completed_tasks = TimeSlot.objects.filter(
                report__in=reports,
                status='completed'
            ).count()
            task_completion_score = (completed_tasks / total_classes * 100) if total_classes > 0 else 0
            
            # Time discipline score (simplified - based on report submission consistency)
            submitted_days = reports.count()
            time_discipline_score = (submitted_days / total_days) * 100 if total_days > 0 else 0
            
            # Final KPI (weighted average)
            final_kpi = (
                attendance_score * 0.4 +
                task_completion_score * 0.4 +
                time_discipline_score * 0.2
            )
            
            kpi_data.append({
                'instructorId': str(instructor.id),
                'instructorName': instructor.name,
                'totalClasses': total_classes,
                'totalWorkingHours': round(total_hours, 1),
                'attendanceScore': round(attendance_score, 1),
                'taskCompletionScore': round(task_completion_score, 1),
                'timeDisciplineScore': round(time_discipline_score, 1),
                'finalKPI': round(final_kpi, 1)
            })
        
        serializer = KPISerializer(kpi_data, many=True)
        return Response(serializer.data)
    
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return User.objects.all()
        return User.objects.filter(id=user.id)
    
    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        """Get current authenticated user"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)