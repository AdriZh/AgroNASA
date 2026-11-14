"""Make a sandbox-friendly copy of app/index.html (no <html>/<head>/<body> wrapper) for publishing as a claude.ai artifact."""
import pathlib, sys
src = pathlib.Path(__file__).resolve().parent.parent / "app/index.html"
s = src.read_text()
body = s.split("<!--ARTIFACT-START-->", 1)[1].split("<!--ARTIFACT-END-->", 1)[0].replace("</head>\n<body>\n", "")
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else src.with_name("artifact.html")
out.write_text(body)
print("wrote", out)
