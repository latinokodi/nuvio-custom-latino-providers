import subprocess
import json
import sys
import os

PROVIDERS_TO_TEST = [
    # Ported from Balandro
    "ciberdocumentales",
    "cinehindi",
    "creyente",
    "documentaleson",
    "documentalesonline",
    "mundodesconocido",
    "retrocinema",
    "todocineclasico",
    "verpelis",
    "retrotv",
    
    # Existing from Luvio (All 10)
    "areshd",
    "cinemitas",
    "detodopeliculas",
    "gnula",
    "seriesflix",
    "seriesgato",
    "seriespapaya",
    "seriesretro",
    "vitaminagg",
    "zonaleros"
]

def run_provider_test(provider):
    print(f"\n>>> Running test for: {provider} ...")
    cmd = ["node", "test_providers.js", provider]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8")
        print(res.stdout)
        if res.stderr:
            print(f"Error output:\n{res.stderr}", file=sys.stderr)
        return res.returncode == 0
    except subprocess.TimeoutExpired:
        print(f"[-] Test for {provider} timed out after 60 seconds.")
        return False
    except Exception as e:
        print(f"[-] Failed to run test for {provider}: {e}")
        return False

def main():
    print("==================================================")
    print("NUVIO PROVIDERS VALIDATION SUITE")
    print("==================================================")
    
    results = {}
    for p in PROVIDERS_TO_TEST:
        success = run_provider_test(p)
        results[p] = "PASSED" if success else "FAILED"
        
    print("\n==================================================")
    print("FINAL TEST EXECUTION SUMMARY")
    print("==================================================")
    print(f"{'Provider ID':<25} | {'Status':<10}")
    print("-" * 40)
    for p, status in results.items():
        print(f"{p:<25} | {status:<10}")
    print("==================================================")

if __name__ == "__main__":
    # Ensure we are in the directory of the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir:
        os.chdir(script_dir)
    main()
