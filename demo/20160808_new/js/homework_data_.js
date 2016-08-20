/**
 * Created by SD01 on 2016/8/9.
 */

(function () {


   var d3= {
        "class_student_num": "47", // 班级人数
        "assignments": [{
            "assignment_id": "1000", // 作业ID
            "subject_name": "数学",
            "assignment_name": "", // 作业名称
            "begin_time": "2016-08-01 15:00:00", // 开始时间
            "end_time": "2016-08-02 15:00:00", // 截止时间
            "notice": "作业提醒",
            "remarks": [
                {
                    "type": "1", // 1: 音频 2: 图片
                    "url": "" // 地址
                }
            ],
            "questions": [
                {
                    "question_id": "1000",
                    "type": "1", // 1: 选择 2: 判断 3: 填空 4: 问答
                    "score": "5", // 分值
                    "answer": "A" // 多选: "A,B,C" 判断: "对/错"
                }
            ],
            "submitted": "16", // 提交人数
            "assignment_status": "1", // 1: 未做 2: 批改中 3: 需订正 4: 订正完成
            "my_answers": [
                {
                    "text": "A"
                },
                {
                    "text": "A,C"
                },
                {
                    "text": "对"
                },
                {
                    "text": "错"
                },
                {
                    "images": ["http://1.jpg", "http://1.jpg"]
                }
            ], // 学生作答
            "correct_result": [
                {
                    "is_correct": "0" // 0: 错误 1: 正确
                },
                {
                    "is_correct": "0"
                },
                {
                    "is_correct": "1"
                },
                {
                    "is_correct": "1"
                },
                {
                    "is_correct": "1",
                    "images": ["http://1.jpg", "http://1.jpg"] // 老师批改笔迹
                }
            ], // 批改结果
            "total_score": "87", // 得分
            "class_rank": "1" // 班级排名
        }
    ]}


    var d = {
        "assignment_id": "1000", // 作业ID
        "subject_name": "数学",
        "assignment_name": "周四家庭作业", // 作业名称
        "notice":"请大家完成黄冈密卷期中检测卷",//作业批注
        "begin_time": "2016-08-01 15:00:00", // 开始时间
        "end_time": "2016-08-02 15:00:00", // 截止时间
        "class_student_num":"47",
        "remarks": [
            {
                "type": "1", // 1: 音频 2: 图片
                "url": "http://yinyueshiting.baidu.com/data2/music/122873158/49046814400128.mp3?xcode=7504faab264af5802bb21879f3eb947d" // 地址
            },
            {
                "type":"0",
                "url":"http://d.hiphotos.baidu.com/image/h%3D200/sign=35a6dc72d7160924c325a51be407359b/86d6277f9e2f0708ab639124ee24b899a901f2b4.jpg"
            }
        ],
        "questions": [
            {
                "question_id": "1000",
                "type": "1", // 1: 选择 2: 判断 3: 填空 4: 问答
                "score": "5", // 分值
                "answer": "A" // 多选: "A,B,C" 判断: "对/错"
            },
            {
                "question_id": "1001",
                "type": "2", // 1: 选择 2: 判断 3: 填空 4: 问答
                "score": "5", // 分值
                "answer": "对" // 多选: "A,B,C" 判断: "对/错"
            },
            {
                "question_id": "1003",
                "type": "2", // 1: 选择 2: 判断 3: 填空 4: 问答
                "score": "5", // 分值
                "answer": "错" // 多选: "A,B,C" 判断: "对/错"
            },
            {
                "question_id": "1004",
                "type": "3", // 1: 选择 2: 判断 3: 填空 4: 问答
                "score": "5", // 分值
                "answer": "我是空1" // 多选: "A,B,C" 判断: "对/错"
            },
            {
                "question_id": "1005",
                "type": "1", // 1: 选择 2: 判断 3: 填空 4: 问答
                "score": "5", // 分值
                "answer": "A,B" // 多选: "A,B,C" 判断: "对/错"
            }
        ],
        "submitted": "16", // 提交人数
        "assignment_status": "1", // 1: 未做 2: 批改中 3: 需订正 4: 订正完成
        "my_answers": [
            {
                "text": "A"
            },
            {
                "text": "A,C"
            },
            {
                "text": "对"
            },
            {
                "text": "错"
            },
            {
                "images": ["http://1.jpg", "http://1.jpg"]
            }
        ], // 学生作答
        "correct_result": [
            {
                "is_correct": "0" // 0: 错误 1: 正确
            },
            {
                "is_correct": "0"
            },
            {
                "is_correct": "1"
            },
            {
                "is_correct": "1"
            },
            {
                "is_correct": "1",
                "images": ["http://1.jpg", "http://1.jpg"] // 老师批改笔迹
            }
        ], // 批改结果
        "total_score": "87", // 得分
        "class_rank": "1" // 班级排名
    };


    // 提交的数据
    var d2=[
        {
            "text": "A"
        },
        {
            "text": "A,C"
        },
        {
            "text": "对"
        },
        {
            "text": "错"
        },
        {
            "images": ["http://1.jpg", "http://1.jpg"]
        }
    ];

    transmitData(JSON.stringify( d));
})();
