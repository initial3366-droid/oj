package com.qoj.module.course.mapper;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.qoj.module.course.entity.CourseClass;
import com.qoj.module.course.vo.CourseClassVO;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CourseClassMapper extends BaseMapper<CourseClass> {
    @Select("SELECT class_id FROM course_classes WHERE course_id = #{courseId} ORDER BY class_id FOR UPDATE")
    List<Long> classIdsLocked(@Param("courseId") Long courseId);
    @Select("SELECT class_id FROM course_classes WHERE course_id = #{courseId} ORDER BY class_id")
    List<Long> classIds(@Param("courseId") Long courseId);

    @Select("""
        SELECT cc.course_id, c.id, c.name FROM course_classes cc
        JOIN classes c ON c.id = cc.class_id ${ew.customSqlSegment}
        """)
    List<CourseClassVO> classes(@Param("ew") Wrapper<CourseClass> wrapper);
}
