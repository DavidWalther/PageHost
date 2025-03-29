
# Regex Util
# “|” // matches german quote signs
# "[\w\s äöü,\.?]+"  // match words, spaces, umlauts, comma, dot question mark surounded by quotes

# Global Variables
#ID_STORY="000s..." # TestStory
#ID_CHAPTER="000c..." # TestChapter 1

# import Paragraphs:
# text:
# * use '*' for bullet points
#
# html:
# 'ul' or 'ol' need the style 'slds-list_dotted', 'slds-list_vertical-space-medium'
# 'li' needs the style 'slds-item' 

# ====== Process ======
# 1. Create Chapter
# 2. Create Paragraphs for Chapter and News at the same time

id_local_story='000s00000000000007'
id_local_chapter='000c00000000000042'
id_local_story_welcome='000s00000000000005'
id_local_chapter_news='000c00000000000032'
id_local_chapter_versions='000c00000000000033'

id_test_story='000s00000000000009'
id_test_chapter='000c00000000000029'
id_test_story_welcome='000s00000000000011'
id_test_chapter_news='000c00000000000023'
id_test_chapter_versions='000c00000000000024'

id_prod_story='000s00000000000009'
id_prod_chapter='000c00000000000029'
id_prod_story_welcome='000s00000000000011'
id_prod_chapter_news='000c00000000000023'
id_prod_chapter_versions='000c00000000000024'


#id_story=$id_local_story
#id_story=$id_test_story
#id_story=$id_prod_story
id_story_welcome=$id_local_story_welcome
#id_story_welcome=$id_test_story_welcome
#id_story_welcome=$id_prod_story_welcome
#id_chapter=$id_local_chapter
#id_chapter=$id_test_chapter
#id_chapter=$id_prod_chapter
#id_chapter_news=$id_local_chapter_news
#id_chapter_news=$id_test_chapter_news
#id_chapter_news=$id_prod_chapter_news
id_chapter_versions=$id_local_chapter_versions
#id_chapter_versions=$id_test_chapter_versions
#id_chapter_versions=$id_prod_chapter_versions

publish_date='2024-07-01 09:00:00'

# Flush Cache

# node private/database/DataCache/DataCache.js


# ====== Template ======

#SORT_NUMBER=
#NAME=""
#PUBLISH_DATE=""
#CONTENT=''
#npm run create -- --table paragraph --operation create --name "$NAME" --sortnumber $SORT_NUMBER --chapterid $ID_CHAPTER --storyid $ID_STORY --publishdate "$PUBLISH_DATE" --content "$CONTENT" --htmlcontent "$HTML_CONTENT"
# Version-TPL

#HTML_CONTENT='<slds-card no-footer><span slot="header" >version-1.7.0 (2024-07-6)</span><div><span>Funktionen:</span><ul class="slds-list_dotted"><li></li></ul></div><div><span>Technisch:</span><ul class="slds-list_dotted"></ul></div></slds-card>'

#CONTENT='Funktionen:
#* Die neuesten Versionen und News werden zuerst angezeigt
#
#Technisch
#* Anzeigen von Titeln in Textabsätzen
#* Neue Tabelle mit Metadaten für andere Seiten'

#HTML_CONTENT='<slds-card no-footer><span slot="header" >version-1.8.0 (2024-06-17)</span><div><ul><li><span>Funktionen:</span></li><li><ul class="slds-list_dotted"><li class="slds-item" >Die neuesten Versionen und News werden zuerst angezeigt</li></ul></li><li><span>Technisch</span></li><li><ul class="slds-list_dotted"><li class="slds-item" >Anzeigen von Titeln in Textabsätzen</li><li class="slds-item" >Neue Tabelle mit Metadaten für andere Seiten</li></ul></li><ul></div></slds-card>'

#npm run create -- --table paragraph --operation create --name "$NAME" --sortnumber $SORT_NUMBER --chapterid $ID_CHAPTER --storyid $ID_STORY --publishdate "$PUBLISH_DATE" --content "$CONTENT" --htmlcontent "$HTML_CONTENT"



# ====== Content ======



chapter_name='... du hast nur 5 Minuten'
storyid=$id_story
sortnumber=7
#npm run create -- --table chapter --operation create --name "$chapter_name" --sortnumber $sortnumber --storyid $storyid --publishdate "$publish_date"

# in one paragraph:
#
# - Du bist nackt
# - Du bist dabei deine Aufgaben im Haushalt zu erledigen
# - Ohne Ankündigung kommt der Befehl "Werde feucht!"
# - Du musst dich mit Gesicht zur nächsten Wand aufstellen
# - Du musst deine Beine öffnen
# - Du musst deine Hände auf den Hinterkopf legen
# - Du musst laut und deutlich von einer Fantasie erzählen
# - Du darfst dich nicht bewegen
# - Nach 5 Minuten wird geprüft ob du feucht genug geworfen bist
# - Du wirst bestraft, wenn nicht.
# - Du musst dich wieder um deine Aufgaben kümmern
# - Der Befehl kann zu jeder Zeit kommen. Auch mehrmals am Tag.

chapterid=$id_chapter
storyid=$id_story

sortnumber=1
content='* Du bist nackt
* Du bist dabei deine Aufgaben im Haushalt zu erledigen
* Ohne Ankündigung kommt der Befehl "Werde feucht!"
* Du musst dich mit Gesicht zur nächsten Wand aufstellen
* Du musst deine Beine öffnen
* Du musst deine Hände auf den Hinterkopf legen
* Du musst laut und deutlich von einer Fantasie erzählen
* Du darfst dich nicht bewegen
* Nach 5 Minuten wird geprüft ob du feucht genug geworfen bist
* Du wirst bestraft, wenn nicht.
* Du musst dich wieder um deine Aufgaben kümmern'
htmlcontent='<div><ul class="slds-list_dotted slds-list_vertical-space-medium"><li class="slds-item" >Du bist nackt</li><li class="slds-item" >Du bist dabei deine Aufgaben im Haushalt zu erledigen</li><li class="slds-item" >Ohne Ankündigung kommt der Befehl "Werde feucht!"</li><li class="slds-item" >Du musst dich mit Gesicht zur nächsten Wand aufstellen</li><li class="slds-item" >Du musst deine Beine öffnen</li><li class="slds-item" >Du musst deine Hände auf den Hinterkopf legen</li><li class="slds-item" >Du musst laut und deutlich von einer Fantasie erzählen</li><li class="slds-item" >Du darfst dich nicht bewegen</li><li class="slds-item" >Nach 5 Minuten wird geprüft ob du feucht genug geworfen bist</li><li class="slds-item" >Du wirst bestraft, wenn nicht.</li><li class="slds-item" >Du musst dich wieder um deine Aufgaben kümmern</li></ul></div>'
#npm run create -- --table paragraph --operation create --name "$name" --sortnumber $sortnumber --chapterid $chapterid --storyid $storyid --publishdate "$publish_date" --content "$content" --htmlcontent "$htmlcontent"

sortnumber=2
content='* Der Befehl kann zu jeder Zeit kommen. Auch mehrmals am Tag.'
htmlcontent='<span>Der Befehl kann zu jeder Zeit kommen. Auch mehrmals am Tag.</span>'
#npm run create -- --table paragraph --operation create --name "$name" --sortnumber $sortnumber --chapterid $chapterid --storyid $storyid --publishdate "$publish_date" --content "$content" --htmlcontent "$htmlcontent"

### add News paragraph

# template
# <slds-card>
#       <span slot="header">Update YYYY-MM-DD<span>
#       <div>
#           <ul class="slds-list_dotted" >
#               <li class="slds-item">
#                   <a href="/redirect_ID">Link Label</a>
#               </li>
#               <li class="slds-item">...</li>
#           </ul>
#       </div>
#   </slds-card>

#==================== News ====================

sortnumber=2
chapterid=$id_chapter_news
storyid=$id_story_welcome
content='Update 2024-06-23
* Ein neues Kapitel für "Stell dir mal vor ..." ist dazu gekommen. :)'
htmlcontent='<slds-card no-footer><span slot="header" >Update 2024-06-23</span><div><ul class="slds-list_dotted"><li class="slds-item" >Ein neues Kapitel für "Stell dir mal vor ..." ist dazu gekommen. <a href="/'$id_chapter'">Hier geht es zum Kapitel</a></li></ul></div></slds-card>'
#npm run create -- --table paragraph --operation create --sortnumber $sortnumber --chapterid $id_chapter_news --storyid $id_story_welcome --publishdate "$publish_date" --content "$content" --htmlcontent "$htmlcontent"


#==================== Versions ====================

#------- Example - Content -------
## 1.9.0 (2024-07-01)

# Feature:
# - Bücher mit vielen Kapiteln bekommen eine Auswahlliste statt Kapitel-Buttons

# Technical:
# - Erstellung eines Endpunktes zum Abrufen von Metadaten
# - Erster abrufen von Stories per Query-Event

# ------- Example - HTML Content -------
# <slds-card no-footer>
#   <span slot="header" >version-1.8.0 (2024-06-17)</span>
#   <div>
#     <ul>
#       <li><span>Funktionen:</span></li>
#       <li>
#         <ul class="slds-list_dotted">
#           <li class="slds-item" >Die neuesten Versionen und News werden zuerst angezeigt</li>
#         </ul>
#       </li>
#       <li><span>Technisch</span></li>
#       <li>
#         <ul class="slds-list_dotted">
#           <li class="slds-item" >Anzeigen von Titeln in Textabsätzen</li>
#           <li class="slds-item" >Neue Tabelle mit Metadaten für andere Seiten</li>
#         </ul>
#       </li>
#     </ul>
#   </div>
# </slds-card>

sortnumber=10
chapterid=$id_chapter_versions
storyid=$id_story_welcome
name="version-1.9.0 (2024-07-01)"
content='Funktionen:
* Bücher mit vielen Kapiteln bekommen eine Auswahlliste statt Kapitel-Buttons

Technisch:
* Erstellung eines Endpunktes zum Abrufen von Metadaten
* Erster abrufen von Stories per Query-Event'
htmlcontent='<slds-card no-footer><span slot="header" >version-1.9.0 (2024-07-01)</span><div><ul><li><span>Funktionen:</span></li><li><ul class="slds-list_dotted"><li class="slds-item" >Bücher mit vielen Kapiteln bekommen eine Auswahlliste statt Kapitel-Buttons</li></ul></li><li><span>Technisch</span></li><li><ul class="slds-list_dotted"><li class="slds-item" >Erstellung eines Endpunktes zum Abrufen von Metadaten</li><li class="slds-item" >Erster abrufen von Stories per Query-Event</li></ul></li><ul></div></slds-card>'
#npm run create -- --table paragraph --operation create --name "$name" --sortnumber $sortnumber --chapterid $chapterid --storyid $storyid --publishdate "$publish_date" --content "$content" --htmlcontent "$htmlcontent"