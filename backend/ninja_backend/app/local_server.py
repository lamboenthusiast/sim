import os
import json
import logging
from typing import List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .message_extractor.fine_tune import train_model
from .routers import messages

app = FastAPI() 