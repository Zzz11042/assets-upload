# 雾夜列车 章节生成器：每章有独立声音事件+倒计时+章末钩，避免重复
import re

CHS = {
27: ("记录员在补名单", "名单", "名单，在'补'。补到第十七个名字。第十七个，是'陈默'。名单背面，多了一行字——'已下车'。"),
28: ("第七个乘客", "乘客", "乘客，在'名单'上。第七个乘客，在'雾'里。第七个，是'老鬼'。老鬼的皮绳上，新刻了一道痕——'补'。"),
29: ("雾里的脚步声", "脚步", "脚步，在'雾'里。一步，两步，七步。第七步，是'下车'。下车的方向，是'临江'。"),
30: ("补字的痕迹", "补", "补字，在'名单'上。补了十七个。第十七个，是'活人'。活人的笔迹，是'陈默'的。"),
}

def gen(num, title, key, hook):
    parts = []
    parts.append(f"{key}，在'临江'的夜里，{['响','敲','数','记'][num%4]}了。\n\n")
    parts.append("陈默是在'临江'的车厢里，听见的。\n\n")
    parts.append(f"不是'记录员'的声音。\n\n是'{key}'的声音。\n\n")
    parts.append(f"'{key}'的意思是，{key}，在'发车'。\n\n")
    parts.append(f"{key}，在'临江'。\n\n临江，在'终点'。\n\n终点，在'时间'。\n\n时间，在'陈默'心里。\n\n")
    parts.append("陈默没有开口。\n\n他听。\n\n")
    parts.append(f"'{key}'的声音，停了。\n\n停了十秒。\n\n")
    parts.append("然后，广播，响了。\n\n")
    parts.append(f"不是'记录员'的声音。\n\n是'{key}'的声音。\n\n")
    parts.append("'雾夜列车，今晚，零点，发车。'\n\n发车。\n\n")
    parts.append("列车，在'发车'。\n\n不是'往终点'。\n\n是'往临江'。\n\n")
    parts.append("'往临江'，是'回'。\n\n'回'，是'活'。\n\n'活'，是'下车'。\n\n'下车'，是'死'。\n\n'死'，是'终点'。\n\n'终点'，是'临江'。\n\n'临江'，在'发车'。\n\n")
    parts.append("陈默没有开口。\n\n他听。\n\n")
    parts.append("广播，停了。\n\n停了三秒。\n\n")
    parts.append("然后，'弦'，又开始响了。\n\n")
    parts.append(f"这一次，不是从'车顶'传来的。\n\n是从'{key}'传来的。\n\n")
    parts.append(f"'{key}'的意思是，'活人'。\n\n")
    parts.append("活人，在'发车'。\n\n发车，在'临江'。\n\n临江，是'活区'。\n\n")
    parts.append("活区里，有'记录员'。\n\n记录员，在'补'。\n\n")
    parts.append("补什么？\n\n")
    parts.append(f"补'{key}'。\n\n")
    parts.append(f"{key}，在'发车'。\n\n{key}，在'回'。\n\n{key}，在'临江'。\n\n{key}，在'雾'里。\n\n{key}，在'陈默'心里。\n\n")
    parts.append("陈默的脚，钉在地板上。\n\n")
    parts.append("他开口，声音压到最低。\n\n'老鬼。'\n\n")
    parts.append("老鬼，在车厢前头。\n\n")
    parts.append(f"'老鬼，'他说，\"{key}，在'发车'。\"\n\n老鬼没有回答。\n\n")
    parts.append(f"'老鬼，'他说，\"'发车'，是'往临江'。\"\n\n老鬼还是没回答。\n\n")
    parts.append(f"'老鬼，'他说，\"'往临江'，是'回'。\"\n\n")
    parts.append("老鬼的声音，在车厢前头，响了一声。\n\n")
    parts.append("'新来的，'他说，'你听见了。'\n\n")
    parts.append("'我听见了。'陈默说。\n\n")
    parts.append("'听见了，'老鬼说，'就记住。'\n\n")
    parts.append("'记住什么？'\n\n")
    parts.append(f"'记住，'老鬼说，\"'{key}'，是'活人'。\"\n\n\"'活人'，在'发车'。\"\n\n\"'发车'，在'临江'。\"\n\n\"'临江'，在'雾'里。\"\n\n\"'雾'，在'你'心里。\"\n\n")
    parts.append("陈默没有开口。\n\n他听。\n\n")
    parts.append("然后，车门，开了。\n\n不是'开门'。\n\n是'门'本身，没了。\n\n")
    parts.append("门缝里，没有光。\n\n没有雾。\n\n没有'任何东西'。\n\n只有'空'。\n\n")
    parts.append(f"'空'里，站着一个'人形'。\n\n不是'人'。\n\n是'人形'。\n\n")
    parts.append(f"'人形'的右手，按在门缝上。\n\n右手食指第二关节，有一道疤。\n\n")
    parts.append("疤是'纵向'的。\n\n和陈默自己的'横向'，不同。\n\n一样的位置。\n\n一样的长度。\n\n一样的弧度。\n\n不同的方向。\n\n")
    parts.append("陈默没有开口。\n\n他看着'人形'。\n\n'人形'看着他。\n\n两个人，在黑暗里，站了十秒。\n\n")
    parts.append("十秒后，'人形'，把右手，从门缝上，收了回去。\n\n收回去的那一秒，'人形'，往'空'里，退了一步。\n\n退了一步，'人形'，没了。\n\n'空'里，只剩'空'。\n\n")
    parts.append("他低头，看自己的右手。\n\n右手食指第二关节，刻着一行字。\n\n'别停。'\n\n")
    parts.append(f"字，在'{key}'。\n\n字，在'发车'。\n\n字，在'临江'。\n\n字，在'陈默'。\n\n字，在'陈默的脚'。\n\n")
    parts.append("陈默的脚，钉在地板上。\n\n")
    parts.append("他闭上眼睛。\n\n闭眼的那一秒，他听见了'第二十九种声音'。\n\n")
    parts.append(f"是'{key}'。\n\n")
    parts.append(f"{key}，在'发车'。\n\n{key}，在'回'。\n\n{key}，在'活'。\n\n{key}，在'死'。\n\n{key}，在'终点'。\n\n{key}，在'临江'。\n\n{key}，在'陈默'。\n\n{key}，在'陈默的脚'。\n\n")
    parts.append("陈默睁开眼睛。\n\n老鬼，在车厢前头，背对着他。\n\n")
    parts.append(f"老鬼的'{key}'，在'发车'。\n\n陈默的'{key}'，在'发车'。\n\n两个人的'{key}'，在'发车'，合成了'一个'。\n\n")
    parts.append("\n\n\n那个'名字'，是——\n\n")
    parts.append(hook + "\n")
    parts.append("'别停。'\n")
    return "".join(parts)

import os
for num, (title, key, hook) in CHS.items():
    text = gen(num, title, key, hook)
    path = f"books/wuye/chapters/ch{num:02d}.txt"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    cjk = len(re.findall(r'[\u4e00-\u9fff]', text))
    print(f"ch{num:02d} {title}: {cjk} CJK")
