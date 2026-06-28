import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { PlacementTestsService } from './placement-tests.service';
import { CreatePlacementTestDto } from './dto/create-placement-test.dto';
import { UpdatePlacementTestDto } from './dto/update-placement-test.dto';
import { SubmitPlacementTestDto } from './dto/submit-placement-test.dto';
import { SubmitAllPlacementTestsDto } from './dto/submit-all-placement-tests.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('placement-tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlacementTestsController {
  constructor(private readonly placementTestsService: PlacementTestsService) {}

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() createDto: CreatePlacementTestDto) {
    return this.placementTestsService.create(createDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STUDENT)
  async findAll(@Request() req) {
    return this.placementTestsService.findAll(req.user.role, req.user.id);
  }

  @Get('my-results')
  @Roles(Role.STUDENT)
  async getMyResults(@Request() req) {
    return this.placementTestsService.getMyResults(req.user.id);
  }

  /**
   * POST /placement-tests/submit-all
   * Student submits answers for ALL placement tests in one request.
   * Returns per-subject levels and placementTestCompleted: true.
   */
  @Post('submit-all')
  @Roles(Role.STUDENT)
  async submitAll(@Request() req, @Body() dto: SubmitAllPlacementTestsDto) {
    return this.placementTestsService.submitAll(req.user.id, dto);
  }

  @Get('subject/:subjectId')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findBySubjectId(@Param('subjectId', ParseIntPipe) subjectId: number, @Request() req) {
    return this.placementTestsService.findBySubjectId(subjectId, req.user.role, req.user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STUDENT)
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.placementTestsService.findOne(id, req.user.role, req.user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdatePlacementTestDto) {
    return this.placementTestsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.placementTestsService.remove(id);
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT)
  async submitAnswers(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() submitDto: SubmitPlacementTestDto,
  ) {
    return this.placementTestsService.submitAnswers(id, req.user.id, submitDto);
  }
}
