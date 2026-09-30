import plistlib
import uuid
from pathlib import Path

OUT = Path(__file__).parent / "dist" / "photos-vers-drive-unsigned.shortcut"


def uid():
    return str(uuid.uuid4()).upper()


def out(output_uuid, name):
    return {"Value": {"Type": "ActionOutput", "OutputUUID": output_uuid, "OutputName": name},
            "WFSerializationType": "WFTextTokenAttachment"}


def var(name):
    return {"Value": {"Type": "Variable", "VariableName": name},
            "WFSerializationType": "WFTextTokenAttachment"}


def text(*parts):
    s, ranges = "", {}
    for p in parts:
        if isinstance(p, str):
            s += p
        else:
            ranges[f"{{{len(s)}, 1}}"] = p["Value"]
            s += "￼"
    return {"Value": {"string": s, "attachmentsByRange": ranges},
            "WFSerializationType": "WFTextTokenString"}


def action(ident, **params):
    return {"WFWorkflowActionIdentifier": f"is.workflow.actions.{ident}",
            "WFWorkflowActionParameters": params}


def set_var(name, value):
    return action("setvariable", WFVariableName=name, WFInput=value)


u_folder, u_ask, u_case, u_repl, u_date, u_fmt = (uid() for _ in range(6))
u_photo, u_named, u_oui = uid(), uid(), uid()
g_repeat, g_if, g_menu = uid(), uid(), uid()

actions = [
    action("file.select", UUID=u_folder, WFPickingMode="Folders", SelectMultiple=False),
    set_var("Dossier", out(u_folder, "Fichier")),
    action("ask", UUID=u_ask, WFAskActionPrompt="Sujet ?", WFInputType="Text",
           WFAskActionDefaultAnswer="photos"),
    action("text.changecase", UUID=u_case, text=text(out(u_ask, "Texte fourni")),
           WFCaseType="lowercase"),
    action("text.replace", UUID=u_repl, WFInput=text(out(u_case, "Texte mis à jour")),
           WFReplaceTextFind=" ", WFReplaceTextReplace="-"),
    set_var("Prefixe", out(u_repl, "Texte mis à jour")),
    action("date", UUID=u_date, WFDateActionMode="Current Date"),
    action("format.date", UUID=u_fmt, WFDate=text(out(u_date, "Date")),
           WFDateFormatStyle="Custom", WFDateFormat="yyyy-MM-dd-HHmm"),
    set_var("Horodatage", out(u_fmt, "Date formatée")),

    action("repeat.count", GroupingIdentifier=g_repeat, WFControlFlowMode=0, WFRepeatCount=30),
    action("conditional", GroupingIdentifier=g_if, WFControlFlowMode=0, WFCondition=101,
           WFInput={"Type": "Variable", "Variable": var("Termine")}),
    action("takephoto", UUID=u_photo, WFCameraCaptureShowPreview=True, WFPhotoCount=1,
           WFCameraCaptureDevice="Back"),
    action("setitemname", UUID=u_named, WFInput=out(u_photo, "Photo"),
           WFName=text(var("Prefixe"), "-", var("Horodatage"), "-", var("Repeat Index"))),
    action("documentpicker.save", WFInput=out(u_named, "Fichier renommé"),
           WFAskWhereToSave=False, WFFolder=var("Dossier"), WFSaveFileOverwrite=False),
    set_var("Nombre", var("Repeat Index")),
    action("choosefrommenu", GroupingIdentifier=g_menu, WFControlFlowMode=0,
           WFMenuPrompt="Suite ?", WFMenuItems=["Encore une photo", "Terminer"]),
    action("choosefrommenu", GroupingIdentifier=g_menu, WFControlFlowMode=1,
           WFMenuItemTitle="Encore une photo"),
    action("choosefrommenu", GroupingIdentifier=g_menu, WFControlFlowMode=1,
           WFMenuItemTitle="Terminer"),
    action("gettext", UUID=u_oui, WFTextActionText="oui"),
    set_var("Termine", out(u_oui, "Texte")),
    action("choosefrommenu", GroupingIdentifier=g_menu, WFControlFlowMode=2),
    action("conditional", GroupingIdentifier=g_if, WFControlFlowMode=2),
    action("repeat.count", GroupingIdentifier=g_repeat, WFControlFlowMode=2),

    action("notification", WFNotificationActionTitle="Photos vers Drive",
           WFNotificationActionBody=text(var("Nombre"), " photo(s) enregistrée(s)")),
]

workflow = {
    "WFWorkflowActions": actions,
    "WFWorkflowClientVersion": "2605.0.5",
    "WFWorkflowMinimumClientVersion": 900,
    "WFWorkflowMinimumClientVersionString": "900",
    "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4282601983, "WFWorkflowIconGlyphNumber": 59446},
    "WFWorkflowImportQuestions": [],
    "WFWorkflowInputContentItemClasses": [],
    "WFWorkflowOutputContentItemClasses": [],
    "WFWorkflowTypes": [],
    "WFQuickActionSurfaces": [],
    "WFWorkflowHasShortcutInputVariables": False,
}

OUT.parent.mkdir(exist_ok=True)
with open(OUT, "wb") as f:
    plistlib.dump(workflow, f, fmt=plistlib.FMT_BINARY)
print(OUT, len(actions), "actions")
